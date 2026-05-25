import { Hono } from "hono";
import type { GlobalUser } from "lib";
import { getPgConnectionFromCacheOrNew } from "../../db/mod.ts";
import { requireHUser } from "../../middleware/auth.ts";
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
routesPresentationObjects.get("/projects/:projectId/metrics", requireHUser(), async (c) => {
  const { projectId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  type MetricRow = { id: string; module_id: string; label: string; variant_label: string | null; value_func: string; format_as: string; value_props: string; required_disaggregation_options: string; results_object_id: string; hide: boolean; last_run_at: string };
  const rows = await projectDb<MetricRow[]>`
    SELECT m.*, mod.last_run_at
    FROM metrics m
    JOIN modules mod ON m.module_id = mod.id
    ORDER BY m.label
  `;
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
      requiredDisaggregationOptions: r.required_disaggregation_options,
      resultsObjectId: r.results_object_id,
      hide: r.hide,
      lastRunAt: r.last_run_at,
    })),
  });
});

// List all presentation objects for a project
routesPresentationObjects.get("/projects/:projectId/presentation_objects", requireHUser(), async (c) => {
  const { projectId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getAllPresentationObjectsForProject(projectDb);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

// Get single presentation object detail
routesPresentationObjects.get("/projects/:projectId/presentation_objects/:id", requireHUser(), async (c) => {
  const { projectId, id } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getPresentationObjectDetail(projectDb, id);
  if (!result.success) return c.json(result, 404);
  return c.json(result);
});

// Create presentation object
routesPresentationObjects.post("/projects/:projectId/presentation_objects", requireHUser(), async (c) => {
  const { projectId } = c.req.param();
  const body = await c.req.json<{ metricId: string; label: string; config: unknown }>();
  if (!body.metricId || !body.label) return c.json({ success: false, err: "metricId and label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await addPresentationObject(projectDb, body.metricId, body.label, body.config ?? {});
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

// Update label
routesPresentationObjects.put("/projects/:projectId/presentation_objects/:id/label", requireHUser(), async (c) => {
  const { projectId, id } = c.req.param();
  const body = await c.req.json<{ label: string }>();
  if (!body.label) return c.json({ success: false, err: "label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await updatePresentationObjectLabel(projectDb, id, body.label);
  if (!result.success) return c.json(result, 404);
  return c.json(result);
});

// Update config
routesPresentationObjects.put("/projects/:projectId/presentation_objects/:id/config", requireHUser(), async (c) => {
  const { projectId, id } = c.req.param();
  const body = await c.req.json<{ config: unknown }>();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await updatePresentationObjectConfig(projectDb, id, body.config);
  if (!result.success) return c.json(result, 404);
  return c.json(result);
});

// Delete presentation object
routesPresentationObjects.delete("/projects/:projectId/presentation_objects/:id", requireHUser(), async (c) => {
  const { projectId, id } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await deletePresentationObject(projectDb, id);
  if (!result.success) return c.json(result, 404);
  return c.json(result);
});

// Duplicate presentation object
routesPresentationObjects.post("/projects/:projectId/presentation_objects/:id/duplicate", requireHUser(), async (c) => {
  const { projectId, id } = c.req.param();
  const body = await c.req.json<{ label: string }>();
  if (!body.label) return c.json({ success: false, err: "label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await duplicatePresentationObject(projectDb, id, body.label);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

// Fetch items for rendering a presentation object
routesPresentationObjects.post("/projects/:projectId/presentation_object_items", requireHUser(), async (c) => {
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
routesPresentationObjects.post("/projects/:projectId/results_value_info", requireHUser(), async (c) => {
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
