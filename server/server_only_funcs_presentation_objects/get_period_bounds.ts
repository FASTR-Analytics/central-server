import type { Sql } from "postgres";
import { detectColumnExists, detectHasPeriodId } from "../db/utils.ts";
import type { PeriodBounds, PeriodOption } from "./lib_types.ts";
import { PERIOD_COLUMN_EXPRESSIONS, QUARTER_ID_COLUMN_EXPRESSIONS, getQuarterIdExpression } from "./period_helpers.ts";

export async function getPeriodBounds(
  projectDb: Sql,
  tableName: string,
  whereStatements: string[] = [],
  firstPeriodOption: PeriodOption | undefined,
  hasPeriodId?: boolean
): Promise<PeriodBounds | undefined> {
  if (!firstPeriodOption) return undefined;

  // Detect hasPeriodId if not provided
  if (hasPeriodId === undefined) {
    hasPeriodId = await detectHasPeriodId(projectDb, tableName);
  }

  // Check if WHERE statements reference dynamic period columns
  const needsPeriodCTE = hasPeriodId && whereStatements.some(stmt =>
    stmt.includes("year") || stmt.includes("month") || stmt.includes("quarter_id")
  );

  // Build source table reference - wrap in CTE if dynamic period columns are referenced
  let sourceTable = tableName;
  let ctePrefix = "";

  if (needsPeriodCTE) {
    ctePrefix = `WITH period_data AS (
  SELECT *,
    ${PERIOD_COLUMN_EXPRESSIONS.year} AS year,
    ${PERIOD_COLUMN_EXPRESSIONS.month} AS month,
    ${getQuarterIdExpression()} AS quarter_id
  FROM ${tableName}
)
`;
    sourceTable = "period_data";
  }

  const whereClause =
    whereStatements.length === 0
      ? ""
      : `WHERE ${whereStatements.join(" AND ")}`;

  if (firstPeriodOption === "period_id") {
    const res = (
      await projectDb.unsafe<
        { min_period_id: number | null; max_period_id: number | null }[]
      >(
        `${ctePrefix}SELECT MIN(period_id) as min_period_id, MAX(period_id) as max_period_id
FROM ${sourceTable}
${whereClause}`
      )
    ).at(0);
    if (res?.min_period_id != null && res?.max_period_id != null) {
      return {
        periodOption: "period_id",
        min: res.min_period_id,
        max: res.max_period_id,
      };
    }
    return undefined;
  }

  if (firstPeriodOption === "year") {
    // If period_id exists, generate year from it; otherwise use year column directly
    let query: string;
    if (hasPeriodId && !needsPeriodCTE) {
      // Direct expression without CTE (no filters on dynamic period columns)
      query = `SELECT MIN(${PERIOD_COLUMN_EXPRESSIONS.year}) as min_year, MAX(${PERIOD_COLUMN_EXPRESSIONS.year}) as max_year
FROM ${tableName}
${whereClause}`;
    } else if (needsPeriodCTE) {
      // Use CTE that already has year computed
      query = `${ctePrefix}SELECT MIN(year) as min_year, MAX(year) as max_year
FROM ${sourceTable}
${whereClause}`;
    } else {
      // No period_id — check if year can be derived from quarter_id
      const hasQuarterIdCol = await detectColumnExists(projectDb, tableName, "quarter_id");
      if (hasQuarterIdCol) {
        query = `SELECT MIN(${QUARTER_ID_COLUMN_EXPRESSIONS.year}) as min_year, MAX(${QUARTER_ID_COLUMN_EXPRESSIONS.year}) as max_year
FROM ${tableName}
${whereClause}`;
      } else {
        // Year column should exist directly
        query = `SELECT MIN(year) as min_year, MAX(year) as max_year
FROM ${tableName}
${whereClause}`;
      }
    }

    const res = (
      await projectDb.unsafe<{ min_year: number | null; max_year: number | null }[]>(query)
    ).at(0);

    if (res?.min_year != null && res?.max_year != null) {
      return {
        periodOption: "year",
        min: res.min_year,
        max: res.max_year,
      };
    }
    return undefined;
  }

  if (firstPeriodOption === "quarter_id") {
    const query = `SELECT MIN(quarter_id) as min_quarter_id, MAX(quarter_id) as max_quarter_id
FROM ${tableName}
${whereClause}`;

    const res = (
      await projectDb.unsafe<{ min_quarter_id: number | null; max_quarter_id: number | null }[]>(query)
    ).at(0);

    if (res?.min_quarter_id != null && res?.max_quarter_id != null) {
      return {
        periodOption: "quarter_id",
        min: res.min_quarter_id,
        max: res.max_quarter_id,
      };
    }
  }

  return undefined;
}
