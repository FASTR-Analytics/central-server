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
  try {
    // Get metric info from project DB
    const metricRow = (await projectDb<{ results_object_id: string; required_disaggregation_options: string; value_func: string }[]>`
      SELECT results_object_id, required_disaggregation_options, value_func FROM metrics WHERE id = ${metricId}
    `).at(0);
    if (!metricRow) return { success: false, err: `Metric not found: ${metricId}` };

    const resultsObjectId = metricRow.results_object_id;

    // Parse disaggregation options from JSON
    let disaggregationOptions: DisaggregationOption[] = [];
    try {
      const parsed = JSON.parse(metricRow.required_disaggregation_options);
      if (Array.isArray(parsed)) disaggregationOptions = parsed;
    } catch { /* empty */ }

    // Determine period option from disaggregation options
    const firstPeriodOption: PeriodOption | undefined =
      disaggregationOptions.find((d): d is PeriodOption =>
        d === "period_id" || d === "year" || d === "quarter_id"
      );

    const tableName = getResultsObjectTableName(resultsObjectId);
    const periodBounds = await getPeriodBounds(projectDb, tableName, [], firstPeriodOption);

    const disaggregationPossibleValues: { [key in DisaggregationOption]?: DisaggregationPossibleValuesStatus } = {};
    for (const disOpt of disaggregationOptions) {
      if (disOpt === "period_id" || disOpt === "year" || disOpt === "quarter_id") continue;
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
