import { periodFilterHasBounds, type GenericLongFormFetchConfig } from "./lib_types.ts";

// ============================================================================
// Type Definitions
// ============================================================================

// Period columns that can be dynamically generated from period_id
const DYNAMIC_PERIOD_COLUMNS = ["year", "month", "quarter_id"] as const;
export type DynamicPeriodColumn = (typeof DYNAMIC_PERIOD_COLUMNS)[number];

// ============================================================================
// Shared Constants for Period Column Generation
// ============================================================================

/**
 * SQL expressions for generating period columns from period_id.
 * These are the single source of truth for period column derivation.
 */
export const PERIOD_COLUMN_EXPRESSIONS = {
  year: "(period_id / 100)::int",
  month: `LPAD((period_id % 100)::text, 2, '0')`,
} as const;

export function getQuarterIdExpression(): string {
  // Central-server always uses Gregorian calendar
  return `(CASE
    WHEN period_id % 100 <= 3 THEN (period_id / 100) * 100 + 1
    WHEN period_id % 100 <= 6 THEN (period_id / 100) * 100 + 2
    WHEN period_id % 100 <= 9 THEN (period_id / 100) * 100 + 3
    ELSE (period_id / 100) * 100 + 4
  END)::int`;
}

export function getPeriodColumnExpression(column: DynamicPeriodColumn): string {
  if (column === "quarter_id") {
    return getQuarterIdExpression();
  }
  return PERIOD_COLUMN_EXPRESSIONS[column];
}

/**
 * SQL expressions for generating columns from quarter_id.
 * Used when quarter_id is the primary time column (no period_id).
 * quarter_id format: YYYYQQ (e.g. 202301 = Q1 2023, 202304 = Q4 2023)
 */
export const QUARTER_ID_COLUMN_EXPRESSIONS = {
  year: "(quarter_id / 100)::int",
} as const;

// ============================================================================
// Period Column Detection and CTE Building
// ============================================================================

export function detectNeededPeriodColumns(
  fetchConfig: GenericLongFormFetchConfig
): Set<DynamicPeriodColumn> {
  const needed = new Set<DynamicPeriodColumn>();

  // Check groupBys
  for (const groupBy of fetchConfig.groupBys) {
    if (DYNAMIC_PERIOD_COLUMNS.includes(groupBy as DynamicPeriodColumn)) {
      needed.add(groupBy as DynamicPeriodColumn);
    }
  }

  // Check filters
  for (const filter of fetchConfig.filters) {
    if (DYNAMIC_PERIOD_COLUMNS.includes(filter.disOpt as DynamicPeriodColumn)) {
      needed.add(filter.disOpt as DynamicPeriodColumn);
    }
  }

  // Check periodFilterExactBounds
  if (fetchConfig.periodFilterExactBounds) {
    const periodOption = fetchConfig.periodFilterExactBounds.periodOption;
    if (DYNAMIC_PERIOD_COLUMNS.includes(periodOption as DynamicPeriodColumn)) {
      needed.add(periodOption as DynamicPeriodColumn);
    }
  }

  return needed;
}
