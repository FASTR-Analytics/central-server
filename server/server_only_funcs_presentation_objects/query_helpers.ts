import type {
  DisaggregationOption,
  GenericLongFormFetchConfig,
  PeriodOption,
} from "./lib_types.ts";
import type { QueryContext } from "./types.ts";

// ============================================================================
// Main and National Query Builders (v2)
// ============================================================================

/**
 * Builds the main query part using externally managed CTEs
 */
export function buildMainQuery(
  sourceTable: string,
  fetchConfig: GenericLongFormFetchConfig,
  queryContext: QueryContext,
  facilityCTEName?: string,
): string {
  const aggregateColumns = buildAggregateColumns(fetchConfig.values, false);

  const identityValueProps = fetchConfig.values
    .filter((v) => v.func === "identity")
    .map((v) => v.prop);

  return buildSelectQueryV2(
    sourceTable,
    fetchConfig,
    {
      selectColumns: fetchConfig.groupBys,
      aggregateColumns,
      groupByColumns: [...fetchConfig.groupBys, ...identityValueProps],
    },
    queryContext,
    facilityCTEName,
  );
}

/**
 * Builds the national totals query using externally managed CTEs
 */
export function buildNationalTotalQueryV2(
  sourceTable: string,
  fetchConfig: GenericLongFormFetchConfig,
  queryContext: QueryContext,
  facilityCTEName?: string,
): string | null {
  // Check conditions for including national total (same logic as v1)
  if (
    !fetchConfig.includeNationalForAdminArea2 ||
    !fetchConfig.groupBys.includes("admin_area_2") ||
    fetchConfig.groupBys.includes("admin_area_3")
  ) {
    return null;
  }

  const nationalCode =
    fetchConfig.includeNationalPosition === "top" ? "__NATIONAL" : "zzNATIONAL";

  // Build SELECT columns with national code replacement
  const selectColumns: string[] = fetchConfig.groupBys.map((gb) =>
    gb === "admin_area_2" ? `'${nationalCode}' AS admin_area_2` : gb,
  );

  const aggregateColumns = buildAggregateColumns(fetchConfig.values, true);

  // GROUP BY excludes admin_area_2 (since it's replaced with a constant)
  const groupByColumns = fetchConfig.groupBys.filter(
    (gb) => gb !== "admin_area_2",
  );

  return buildSelectQueryV2(
    sourceTable,
    fetchConfig,
    {
      selectColumns,
      aggregateColumns,
      groupByColumns,
    },
    queryContext,
    facilityCTEName,
  );
}

// ============================================================================
// SELECT Query Building (v2 - No Internal CTEs)
// ============================================================================

/**
 * Builds SELECT queries without creating internal CTEs
 * This is the v2 version that uses externally managed CTEs
 */
function buildSelectQueryV2(
  sourceTable: string,
  fetchConfig: GenericLongFormFetchConfig,
  options: {
    selectColumns: (string | DisaggregationOption | PeriodOption)[];
    aggregateColumns: string;
    groupByColumns: (string | DisaggregationOption | PeriodOption)[];
  },
  queryContext: QueryContext,
  _facilityCTEName?: string,
): string {
  const { selectColumns, aggregateColumns, groupByColumns } = options;

  const columnPrefixes = new Map<string, string>();
  // No facility joins in central-server

  const applyColumnPrefixes = (columns: (string | DisaggregationOption | PeriodOption)[]) =>
    columns.map((col) => columnPrefixes.get(col as string) || col);

  ///////////////////////
  //                   //
  //    FROM clause    //
  //                   //
  ///////////////////////
  const fromClause = `FROM ${sourceTable}`;

  /////////////////////////
  //                     //
  //    SELECT clause    //
  //                     //
  /////////////////////////
  const adjustedSelectColumns = applyColumnPrefixes(selectColumns);

  const selectStr =
    adjustedSelectColumns.length === 0
      ? aggregateColumns
      : `${adjustedSelectColumns.join(", ")}, ${aggregateColumns}`;

  ////////////////////////
  //                    //
  //    WHERE clause    //
  //                    //
  ////////////////////////
  const whereStatements = buildWhereClause(
    fetchConfig,
    queryContext.hasPeriodId,
    columnPrefixes,
  );

  const whereClause =
    whereStatements.length === 0
      ? ""
      : `WHERE ${whereStatements.join(" AND ")}`;

  ///////////////////////////
  //                       //
  //    GROUP BY clause    //
  //                       //
  ///////////////////////////

  const adjustedGroupByColumns = applyColumnPrefixes(groupByColumns);

  const groupByClause =
    adjustedGroupByColumns.length === 0
      ? ""
      : `GROUP BY ${adjustedGroupByColumns.join(", ")}`;

  ////////////////////
  //                //
  //    Combined    //
  //                //
  ////////////////////

  return `SELECT ${selectStr}
${fromClause}
${whereClause}
${groupByClause}`;
}

// ============================================================================
// WHERE Clause Building
// ============================================================================

/**
 * Builds WHERE clause conditions from fetch configuration
 */
export function buildWhereClause(
  fetchConfig: GenericLongFormFetchConfig,
  hasPeriodId: boolean,
  columnPrefixes?: Map<string, string>,
): string[] {
  const whereStatements: string[] = [];

  // Add filter conditions (case-insensitive for text, direct for integers)
  const INTEGER_COLUMNS = new Set([
    "year",
    "month",
    "quarter_id",
    "period_id",
    "time_point",
  ]);

  for (const filter of fetchConfig.filters) {
    if (filter.values.length === 0) continue;

    const columnName = columnPrefixes?.get(filter.disOpt) || filter.disOpt;
    const isIntegerColumn = INTEGER_COLUMNS.has(filter.disOpt);

    if (isIntegerColumn) {
      // Direct comparison for integer columns
      const values = filter.values.map((v) => Number(v)).join(", ");
      whereStatements.push(`${columnName} IN (${values})`);
    } else {
      // Case-insensitive comparison for text columns
      const quotedValues = filter.values
        .map((v) => `'${String(v).toUpperCase().replace(/'/g, "''")}'`)
        .join(", ");
      whereStatements.push(`UPPER(${columnName}) IN (${quotedValues})`);
    }
  }

  // Add period bounds if specified
  if (fetchConfig.periodFilterExactBounds) {
    const periodColumn = fetchConfig.periodFilterExactBounds.periodOption;

    // Only check for period_id existence if we're actually filtering by period_id
    if (periodColumn === "period_id" && !hasPeriodId) {
      console.warn(
        "Trying to filter by period_id but table doesn't have that column",
      );
      return whereStatements;
    }

    whereStatements.push(
      `${periodColumn} >= ${fetchConfig.periodFilterExactBounds.min}`,
      `${periodColumn} <= ${fetchConfig.periodFilterExactBounds.max}`,
    );
  }
  return whereStatements;
}

// ============================================================================
// Aggregate Column Building
// ============================================================================

/**
 * Builds aggregate column expressions based on value configuration
 */
function buildAggregateColumns(
  values: GenericLongFormFetchConfig["values"],
  forNationalTotal: boolean = false,
): string {
  return values
    .map((valueObj) => {
      if (valueObj.func === "identity") {
        return forNationalTotal
          ? `SUM(${valueObj.prop}) AS ${valueObj.prop}`
          : valueObj.prop;
      }
      return `${valueObj.func.toUpperCase()}(${valueObj.prop}) AS ${valueObj.prop}`;
    })
    .join(", ");
}

// ============================================================================
// Post-Aggregation Expression (v2)
// ============================================================================

/**
 * Applies post-aggregation expression with proper CTE handling
 */
export function applyPostAggregationExpressionV2(
  sqlQuery: string,
  postAggregationExpression: string | undefined,
  groupBys: (DisaggregationOption | PeriodOption)[],
): string {
  if (!postAggregationExpression || !postAggregationExpression.includes("=")) {
    return sqlQuery;
  }

  const chunks = postAggregationExpression
    .split("=")
    .map((chunk) => chunk.trim());
  const value = chunks.at(0);
  const expression = chunks.at(-1);

  if (!value || !expression) {
    return sqlQuery;
  }

  // Protect against division by zero by replacing /column with /NULLIF(column, 0)
  const safeExpression = expression.replace(/\/\s*(\w+)/g, "/ NULLIF($1, 0)");

  const groupByPrefix = groupBys.length === 0 ? "" : `${groupBys.join(", ")}, `;

  // Build the post-aggregation wrapper
  const wrappedQuery = `SELECT ${groupByPrefix}(${safeExpression}) as ${value} FROM (${sqlQuery}) AS subq`;

  return wrappedQuery;
}
