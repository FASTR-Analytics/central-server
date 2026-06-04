import type { Sql } from "postgres";
import {
  detectColumnExists,
  tryCatchDatabaseAsync,
  type APIResponseWithData,
} from "../db/utils.ts";
import { getResultsObjectTableName } from "../db/utils.ts";
import type {
  DisaggregationOption,
  GenericLongFormFetchConfig,
  PeriodOption,
} from "./lib_types.ts";
import { buildQueryContext } from "./get_query_context.ts";
import { buildWhereClause } from "./query_helpers.ts";
import { MAX_REPLICANT_OPTIONS } from "./consts.ts";
import {
  type DynamicPeriodColumn,
  PERIOD_COLUMN_EXPRESSIONS,
  QUARTER_ID_COLUMN_EXPRESSIONS,
  getPeriodColumnExpression,
} from "./period_helpers.ts";

const DYNAMIC_PERIOD_COLUMNS = ["year", "month", "quarter_id"] as const;

export async function getPossibleValues(
  projectDb: Sql,
  resultsObjectId: string,
  disaggregationOption: DisaggregationOption,
  mainDb: Sql,
  filters?: GenericLongFormFetchConfig["filters"],
  periodFilterExactBounds?: {
    periodOption: PeriodOption;
    min: number;
    max: number;
  },
): Promise<APIResponseWithData<{ id: string; label: string }[]>> {
  return await tryCatchDatabaseAsync(async () => {
    const tableName = getResultsObjectTableName(resultsObjectId);

    // Filter out the current disaggregation option from filters
    const filteredFilters =
      filters?.filter((f) => f.disOpt !== disaggregationOption) ?? [];

    // Build minimal fetchConfig to leverage buildQueryContext
    const fetchConfig: GenericLongFormFetchConfig = {
      values: [],
      groupBys: [disaggregationOption],
      filters: filteredFilters,
      periodFilter: undefined,
      periodFilterExactBounds,
      postAggregationExpression: undefined,
    };

    // Use buildQueryContext to determine period joins and filter separation
    const queryContext = await buildQueryContext(
      mainDb,
      projectDb,
      tableName,
      fetchConfig,
    );

    // Build WHERE clause using shared logic
    const whereStatements = buildWhereClause(
      fetchConfig,
      queryContext.hasPeriodId,
    );
    const whereClause =
      whereStatements.length === 0
        ? ""
        : `WHERE ${whereStatements.join(" AND ")}`;

    // Check if this is a dynamic period column (derivable from period_id or quarter_id)
    const isDynamicPeriodColumn =
      (queryContext.hasPeriodId &&
        (DYNAMIC_PERIOD_COLUMNS as readonly string[]).includes(
          disaggregationOption,
        )) ||
      (queryContext.hasQuarterId &&
        disaggregationOption in QUARTER_ID_COLUMN_EXPRESSIONS);

    // Check if any filters reference dynamic period columns
    const filterUsesDynamicPeriodColumn = filteredFilters.some(
      (f) =>
        (queryContext.hasPeriodId &&
          (DYNAMIC_PERIOD_COLUMNS as readonly string[]).includes(f.disOpt)) ||
        (queryContext.hasQuarterId &&
          f.disOpt in QUARTER_ID_COLUMN_EXPRESSIONS),
    );

    // Need period CTE if we're selecting a dynamic column OR filtering by one
    const needsPeriodCTE =
      (queryContext.hasPeriodId || queryContext.hasQuarterId) &&
      (isDynamicPeriodColumn || filterUsesDynamicPeriodColumn);

    // Determine source table and column reference
    let sourceTable = tableName;
    let columnRef: string;

    if (isDynamicPeriodColumn && needsPeriodCTE) {
      // Using CTE, reference computed column directly
      columnRef = disaggregationOption;
    } else if (isDynamicPeriodColumn) {
      // No CTE needed, use inline expression
      if (queryContext.hasPeriodId) {
        columnRef = getPeriodColumnExpression(
          disaggregationOption as DynamicPeriodColumn,
        );
      } else {
        columnRef =
          QUARTER_ID_COLUMN_EXPRESSIONS[
            disaggregationOption as keyof typeof QUARTER_ID_COLUMN_EXPRESSIONS
          ];
      }
    } else {
      // Regular column
      columnRef = disaggregationOption;
    }

    let sqlQuery: string;

    // Check if the column exists before querying (skip for dynamic period columns)
    if (!isDynamicPeriodColumn) {
      const columnExists = await detectColumnExists(
        projectDb,
        tableName,
        disaggregationOption,
      );
      if (!columnExists) {
        return {
          success: false,
          err: "Column does not exist in results table",
        };
      }
    }

    if (needsPeriodCTE) {
      // Wrap in period CTE
      const derivedColumns = queryContext.hasPeriodId
        ? `${PERIOD_COLUMN_EXPRESSIONS.year} AS year,\n    ${PERIOD_COLUMN_EXPRESSIONS.month} AS month,\n    ${getPeriodColumnExpression("quarter_id")} AS quarter_id`
        : `${QUARTER_ID_COLUMN_EXPRESSIONS.year} AS year`;
      const ctePrefix = `WITH period_data AS (
  SELECT *,
    ${derivedColumns}
  FROM ${tableName}
)
`;
      sourceTable = "period_data";
      sqlQuery = `${ctePrefix}SELECT DISTINCT ${columnRef} AS disaggregation_value
FROM ${sourceTable}
${whereClause}
ORDER BY ${columnRef}
LIMIT ${MAX_REPLICANT_OPTIONS + 1}`;
    } else {
      sqlQuery = `SELECT DISTINCT ${columnRef} AS disaggregation_value
FROM ${tableName}
${whereClause}
ORDER BY ${columnRef}
LIMIT ${MAX_REPLICANT_OPTIONS + 1}`;
    }

    const results =
      await projectDb.unsafe<{ disaggregation_value: string }[]>(sqlQuery);

    const possibleValues = results
      .map((opt) => opt.disaggregation_value)
      .filter((v) => v != null && String(v).trim() !== "")
      .map((v) => ({ id: String(v), label: String(v) }));
    return { success: true, data: possibleValues };
  });
}
