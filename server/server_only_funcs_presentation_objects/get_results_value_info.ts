import type { Sql } from "postgres";
import type {
  ResultsValueInfoForPresentationObject,
  DisaggregationOption,
  DisaggregationPossibleValuesStatus,
  PeriodOption,
} from "./lib_types.ts";
import { getPeriodBounds } from "./get_period_bounds.ts";
import { getPossibleValues } from "./get_possible_values.ts";
import { MAX_REPLICANT_OPTIONS } from "./consts.ts";
import { getResultsObjectTableName } from "../db/utils.ts";

export async function getResultsValueInfoForPresentationObject(
  mainDb: Sql,
  projectDb: Sql,
  projectId: string,
  metricId: string,
  moduleLastRun: string,
): Promise<{ success: true; data: ResultsValueInfoForPresentationObject } | { success: false; err: string }> {
  const PHYSICAL_DISAGG_COLS = [
    "admin_area_1", "admin_area_2", "admin_area_3", "admin_area_4",
    "indicator_common_id", "denominator", "denominator_best_or_survey",
    "source_indicator", "target_population", "ratio_type",
    "facility_name", "facility_type", "facility_ownership",
    "facility_custom_1", "facility_custom_2", "facility_custom_3",
    "facility_custom_4", "facility_custom_5",
    "hfa_indicator", "hfa_category", "hfa_sub_category", "time_point",
    "iceh_indicator", "strat", "level",
  ] as const;

  try {
    // Get metric info from project DB
    const metricRow = (await projectDb<{ results_object_id: string }[]>`
      SELECT results_object_id FROM metrics WHERE id = ${metricId}
    `).at(0);
    if (!metricRow) return { success: false, err: `Metric not found: ${metricId}` };

    const resultsObjectId = metricRow.results_object_id;
    const tableName = getResultsObjectTableName(resultsObjectId);

    // Detect actual columns present in the results table
    const colRows = await projectDb<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = ${tableName} AND table_schema = current_schema()
    `;
    const cols = new Set(colRows.map((c) => c.column_name));

    // Build disaggregation options from physical columns present in the table
    const disaggregationOptions: DisaggregationOption[] = PHYSICAL_DISAGG_COLS
      .filter((col) => cols.has(col)) as DisaggregationOption[];

    // Determine period option from actual table columns
    const firstPeriodOption: PeriodOption | undefined =
      cols.has("period_id") ? "period_id"
      : cols.has("quarter_id") ? "quarter_id"
      : cols.has("year") ? "year"
      : undefined;

    const periodBounds = await getPeriodBounds(projectDb, tableName, [], firstPeriodOption);

    const disaggregationPossibleValues: { [key in DisaggregationOption]?: DisaggregationPossibleValuesStatus } = {};
    for (const disOpt of disaggregationOptions) {
      const res = await getPossibleValues(projectDb, resultsObjectId, disOpt, mainDb);
      if (!res.success) {
        disaggregationPossibleValues[disOpt] = { status: "error", message: res.err };
        continue;
      }
      const vals = res.data;
      if (vals.length > MAX_REPLICANT_OPTIONS) {
        disaggregationPossibleValues[disOpt] = { status: "too_many_values" };
      } else if (vals.length === 0) {
        disaggregationPossibleValues[disOpt] = { status: "no_values_available" };
      } else {
        disaggregationPossibleValues[disOpt] = { status: "ok", values: vals };
      }
    }

    return {
      success: true,
      data: { resultsObjectId, metricId, projectId, moduleLastRun, periodBounds: periodBounds ?? undefined, disaggregationPossibleValues },
    };
  } catch (err) {
    return { success: false, err: err instanceof Error ? err.message : String(err) };
  }
}
