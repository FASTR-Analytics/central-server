import { Hono } from "hono";
import type { GlobalUser } from "lib";
import { getPgConnectionFromCacheOrNew } from "../../db/mod.ts";
import { getResultsObjectTableName } from "../../db/utils.ts";
import { requireAuth } from "../../middleware/auth.ts";
import {
  addPresentationObject,
  getAllPresentationObjectsForProject,
  getPresentationObjectDetail,
  updatePresentationObjectLabel,
  updatePresentationObjectConfig,
  deletePresentationObject,
  duplicatePresentationObject,
} from "../../db/project/presentation_objects.ts";
import { getPresentationObjectItems, getResultsValueInfoForPresentationObject } from "../../server_only_funcs_presentation_objects/mod.ts";
import type { GenericLongFormFetchConfig, PeriodOption } from "../../server_only_funcs_presentation_objects/lib_types.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export const routesPresentationObjects = new Hono<Env>();

// List all metrics for a project (with module last_run_at)
routesPresentationObjects.get("/projects/:projectId/metrics", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
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

  return c.json({
    success: true,
    data: rows.map((r) => ({
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
    })),
  });
});

// List all presentation objects for a project
routesPresentationObjects.get("/projects/:projectId/presentation_objects", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getAllPresentationObjectsForProject(projectDb);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

// Get single presentation object detail
routesPresentationObjects.get("/projects/:projectId/presentation_objects/:id", requireAuth(), async (c) => {
  const { projectId, id } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getPresentationObjectDetail(projectDb, id);
  if (!result.success) return c.json(result, 404);
  return c.json(result);
});

// Create presentation object
routesPresentationObjects.post("/projects/:projectId/presentation_objects", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const body = await c.req.json<{ metricId: string; label: string; config: unknown }>();
  if (!body.metricId || !body.label) return c.json({ success: false, err: "metricId and label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await addPresentationObject(projectDb, body.metricId, body.label, body.config ?? {});
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

// Update label
routesPresentationObjects.put("/projects/:projectId/presentation_objects/:id/label", requireAuth(), async (c) => {
  const { projectId, id } = c.req.param();
  const body = await c.req.json<{ label: string }>();
  if (!body.label) return c.json({ success: false, err: "label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await updatePresentationObjectLabel(projectDb, id, body.label);
  if (!result.success) return c.json(result, 404);
  return c.json(result);
});

// Update config
routesPresentationObjects.put("/projects/:projectId/presentation_objects/:id/config", requireAuth(), async (c) => {
  const { projectId, id } = c.req.param();
  const body = await c.req.json<{ config: unknown }>();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await updatePresentationObjectConfig(projectDb, id, body.config);
  if (!result.success) return c.json(result, 404);
  return c.json(result);
});

// Delete presentation object
routesPresentationObjects.delete("/projects/:projectId/presentation_objects/:id", requireAuth(), async (c) => {
  const { projectId, id } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await deletePresentationObject(projectDb, id);
  if (!result.success) return c.json(result, 404);
  return c.json(result);
});

// Duplicate presentation object
routesPresentationObjects.post("/projects/:projectId/presentation_objects/:id/duplicate", requireAuth(), async (c) => {
  const { projectId, id } = c.req.param();
  const body = await c.req.json<{ label: string }>();
  if (!body.label) return c.json({ success: false, err: "label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await duplicatePresentationObject(projectDb, id, body.label);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

// Fetch items for rendering a presentation object
routesPresentationObjects.post("/projects/:projectId/presentation_object_items", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const body = await c.req.json<{
    metricId: string;
    resultsObjectId: string;
    fetchConfig: GenericLongFormFetchConfig;
    firstPeriodOption?: PeriodOption;
    moduleLastRun: string;
  }>();
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getPresentationObjectItems(
    mainDb,
    projectId,
    projectDb,
    body.resultsObjectId,
    body.fetchConfig,
    body.firstPeriodOption,
    body.moduleLastRun,
  );
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

// Fetch results value info (filter options) for a presentation object
routesPresentationObjects.post("/projects/:projectId/results_value_info", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const body = await c.req.json<{
    metricId: string;
    moduleLastRun: string;
  }>();
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getResultsValueInfoForPresentationObject(
    mainDb,
    projectDb,
    projectId,
    body.metricId,
    body.moduleLastRun,
  );
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});
