import { Hono } from "hono";
import type { GlobalUser } from "lib";
import { getPgConnectionFromCacheOrNew } from "../../db/mod.ts";
import { requireAuth } from "../../middleware/auth.ts";
import {
  getAllSlideDeckFolders,
  createSlideDeckFolder,
  updateSlideDeckFolder,
  deleteSlideDeckFolder,
} from "../../db/project/slide_deck_folders.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export const routesSlideDeckFolders = new Hono<Env>();

routesSlideDeckFolders.get("/projects/:projectId/slide_deck_folders", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getAllSlideDeckFolders(projectDb);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeckFolders.post("/projects/:projectId/slide_deck_folders", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const body = await c.req.json<{ label: string; color?: string; description?: string }>();
  if (!body.label) return c.json({ success: false, err: "label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await createSlideDeckFolder(projectDb, body.label, body.color, body.description);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeckFolders.put("/projects/:projectId/slide_deck_folders/:folderId", requireAuth(), async (c) => {
  const { projectId, folderId } = c.req.param();
  const body = await c.req.json<{ label: string; color?: string | null; description?: string | null }>();
  if (!body.label) return c.json({ success: false, err: "label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await updateSlideDeckFolder(projectDb, folderId, body.label, body.color, body.description);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeckFolders.delete("/projects/:projectId/slide_deck_folders/:folderId", requireAuth(), async (c) => {
  const { projectId, folderId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await deleteSlideDeckFolder(projectDb, folderId);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});
