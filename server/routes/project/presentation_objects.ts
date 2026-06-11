import { Hono } from "hono";
import type { GlobalUser } from "lib";
import { getPgConnectionFromCacheOrNew } from "../../db/mod.ts";
import { requireAuth } from "../../middleware/auth.ts";
import { getProjectMetrics } from "../../db/project/metrics.ts";
import {
  addPresentationObject,
  getAllPresentationObjectsForProject,
  getPresentationObjectDetail,
  updatePresentationObjectLabel,
  updatePresentationObjectConfig,
  deletePresentationObject,
  duplicatePresentationObject,
} from "../../db/project/presentation_objects.ts";
import { refetchAndNotifyVisualizations } from "../../task_management/refetch_and_notify.ts";
import { getPresentationObjectItems, getResultsValueInfoForPresentationObject, getPossibleValues } from "../../server_only_funcs_presentation_objects/mod.ts";
import type { DisaggregationOption, GenericLongFormFetchConfig, PeriodOption } from "../../server_only_funcs_presentation_objects/lib_types.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export const routesPresentationObjects = new Hono<Env>();

// List all metrics for a project (with module last_run_at)
routesPresentationObjects.get("/projects/:projectId/metrics", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getProjectMetrics(projectDb);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
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
  await refetchAndNotifyVisualizations(projectDb, projectId);
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
  await refetchAndNotifyVisualizations(projectDb, projectId);
  return c.json(result);
});

// Update config
routesPresentationObjects.put("/projects/:projectId/presentation_objects/:id/config", requireAuth(), async (c) => {
  const { projectId, id } = c.req.param();
  const body = await c.req.json<{ config: unknown }>();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await updatePresentationObjectConfig(projectDb, id, body.config);
  if (!result.success) return c.json(result, 404);
  await refetchAndNotifyVisualizations(projectDb, projectId);
  return c.json(result);
});

// Delete presentation object
routesPresentationObjects.delete("/projects/:projectId/presentation_objects/:id", requireAuth(), async (c) => {
  const { projectId, id } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await deletePresentationObject(projectDb, id);
  if (!result.success) return c.json(result, 404);
  await refetchAndNotifyVisualizations(projectDb, projectId);
  return c.json(result);
});

// Duplicate presentation object
routesPresentationObjects.post("/projects/:projectId/presentation_objects/:id/duplicate", requireAuth(), async (c) => {
  const { projectId, id } = c.req.param();
  const body = await c.req.json<{ label: string; folderId?: string | null }>();
  if (!body.label) return c.json({ success: false, err: "label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await duplicatePresentationObject(projectDb, id, body.label, body.folderId);
  if (!result.success) return c.json(result, 500);
  await refetchAndNotifyVisualizations(projectDb, projectId);
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

routesPresentationObjects.post("/projects/:projectId/replicant_options", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const body = await c.req.json<{
    resultsObjectId: string;
    replicantDisOpt: DisaggregationOption;
    fetchConfig: GenericLongFormFetchConfig;
  }>();
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getPossibleValues(
    projectDb,
    body.resultsObjectId,
    body.replicantDisOpt,
    mainDb,
    body.fetchConfig.filters,
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
