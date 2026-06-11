import type { Sql } from "postgres";
import type { ProjectMetric } from "lib";
import { tryCatchDatabaseAsync } from "../utils.ts";
import type { APIResponseWithData } from "../utils.ts";
import { getResultsObjectTableName } from "../utils.ts";

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

export async function getProjectMetrics(
  projectDb: Sql,
): Promise<APIResponseWithData<ProjectMetric[]>> {
  return await tryCatchDatabaseAsync(async () => {
    type MetricRow = { id: string; module_id: string; label: string; variant_label: string | null; value_func: string; format_as: string; value_props: string; required_disaggregation_options: string; value_label_replacements: string | null; post_aggregation_expression: string | null; results_object_id: string; hide: boolean; last_run_at: string; viz_presets: string | null };
    const rows = await projectDb<MetricRow[]>`
      SELECT m.*, mod.last_run_at
      FROM metrics m
      JOIN modules mod ON m.module_id = mod.id
      ORDER BY m.label
    `;

    // Detect available disaggregation options once per unique results object table
    const uniqueRoIds = [...new Set(rows.map((r) => r.results_object_id))];
    const roAvailableOptions = new Map<string, string[]>();

    for (const roId of uniqueRoIds) {
      const tableName = getResultsObjectTableName(roId);
      const colRows = await projectDb<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = ${tableName} AND table_schema = current_schema()
      `;
      const cols = new Set(colRows.map((c) => c.column_name));
      const opts: string[] = [];

      for (const col of PHYSICAL_DISAGG_COLS) {
        if (cols.has(col)) opts.push(col);
      }

      if (cols.has("period_id")) {
        opts.push("period_id", "year", "quarter_id", "month");
      } else if (cols.has("quarter_id")) {
        opts.push("quarter_id", "year");
      } else if (cols.has("year")) {
        opts.push("year");
      }

      roAvailableOptions.set(roId, opts);
    }

    const metrics = rows.map<ProjectMetric>((r) => ({
      id: r.id,
      moduleId: r.module_id,
      label: r.label,
      variantLabel: r.variant_label,
      valueFunc: r.value_func,
      formatAs: r.format_as,
      valueProps: r.value_props,
      requiredDisaggregationOptions: (() => {
        const available = roAvailableOptions.get(r.results_object_id) ?? [];
        if (!available.includes("admin_area_1")) return r.required_disaggregation_options;
        const existing = JSON.parse(r.required_disaggregation_options ?? "[]") as string[];
        if (existing.includes("admin_area_1")) return r.required_disaggregation_options;
        return JSON.stringify([...existing, "admin_area_1"]);
      })(),
      availableDisaggregationOptions: JSON.stringify(roAvailableOptions.get(r.results_object_id) ?? []),
      valueLabelReplacements: r.value_label_replacements,
      postAggregationExpression: r.post_aggregation_expression,
      resultsObjectId: r.results_object_id,
      hide: r.hide,
      lastRunAt: r.last_run_at,
      vizPresets: r.viz_presets,
    }));

    return { success: true, data: metrics };
  });
}
