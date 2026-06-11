import { Hono } from "hono";
import type { GlobalUser } from "lib";
import { getPgConnectionFromCacheOrNew } from "../../db/mod.ts";
import { requireAuth } from "../../middleware/auth.ts";
import {
  getAllVisualizationFolders,
  createVisualizationFolder,
  updateVisualizationFolder,
  deleteVisualizationFolder,
} from "../../db/project/visualization_folders.ts";
import { updatePresentationObjectFolder } from "../../db/project/presentation_objects.ts";
import {
  refetchAndNotifyVisualizationFolders,
  refetchAndNotifyVisualizations,
} from "../../task_management/refetch_and_notify.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export const routesVisualizationFolders = new Hono<Env>();

routesVisualizationFolders.get("/projects/:projectId/visualization_folders", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getAllVisualizationFolders(projectDb);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesVisualizationFolders.post("/projects/:projectId/visualization_folders", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const body = await c.req.json<{ label: string; color?: string; description?: string }>();
  if (!body.label) return c.json({ success: false, err: "label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await createVisualizationFolder(projectDb, body.label, body.color, body.description);
  if (!result.success) return c.json(result, 500);
  await refetchAndNotifyVisualizationFolders(projectDb, projectId);
  return c.json(result);
});

routesVisualizationFolders.put("/projects/:projectId/visualization_folders/:folderId", requireAuth(), async (c) => {
  const { projectId, folderId } = c.req.param();
  const body = await c.req.json<{ label: string; color?: string | null; description?: string | null }>();
  if (!body.label) return c.json({ success: false, err: "label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await updateVisualizationFolder(projectDb, folderId, body.label, body.color, body.description);
  if (!result.success) return c.json(result, 500);
  await refetchAndNotifyVisualizationFolders(projectDb, projectId);
  return c.json(result);
});

routesVisualizationFolders.delete("/projects/:projectId/visualization_folders/:folderId", requireAuth(), async (c) => {
  const { projectId, folderId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await deleteVisualizationFolder(projectDb, folderId);
  if (!result.success) return c.json(result, 500);
  await refetchAndNotifyVisualizationFolders(projectDb, projectId);
  await refetchAndNotifyVisualizations(projectDb, projectId);
  return c.json(result);
});

routesVisualizationFolders.put("/projects/:projectId/presentation_objects/:id/folder", requireAuth(), async (c) => {
  const { projectId, id } = c.req.param();
  const body = await c.req.json<{ folderId: string | null }>();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await updatePresentationObjectFolder(projectDb, id, body.folderId);
  if (!result.success) return c.json(result, 500);
  await refetchAndNotifyVisualizations(projectDb, projectId);
  return c.json(result);
});
