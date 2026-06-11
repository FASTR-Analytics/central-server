import { Hono } from "hono";
import type { GlobalUser } from "lib";
import { getPgConnectionFromCacheOrNew } from "../../db/mod.ts";
import { requireAuth } from "../../middleware/auth.ts";
import type { SlideDeckConfig, SlidePosition, Slide } from "platform-lib";
import {
  getAllSlideDecks,
  getSlideDeckDetail,
  createSlideDeck,
  updateSlideDeckLabel,
  updateSlideDeckPlan,
  updateSlideDeckConfig,
  moveSlideDeckToFolder,
  duplicateSlideDeck,
  deleteSlideDeck,
  getSlides,
  getSlide,
  createSlide,
  updateSlide,
  deleteSlides,
  duplicateSlides,
  moveSlides,
} from "../../db/project/slide_decks.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export const routesSlideDeck = new Hono<Env>();

// ─── Slide Decks ──────────────────────────────────────────────────────────────

routesSlideDeck.get("/projects/:projectId/slide_decks", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getAllSlideDecks(projectDb);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeck.get("/projects/:projectId/slide_decks/:deckId", requireAuth(), async (c) => {
  const { projectId, deckId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getSlideDeckDetail(projectDb, deckId);
  if (!result.success) return c.json(result, 404);
  return c.json(result);
});

routesSlideDeck.post("/projects/:projectId/slide_decks", requireAuth(), async (c) => {
  const { projectId } = c.req.param();
  const body = await c.req.json<{ label: string; folderId?: string | null }>();
  if (!body.label) return c.json({ success: false, err: "label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await createSlideDeck(projectDb, body.label, body.folderId);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeck.put("/projects/:projectId/slide_decks/:deckId/label", requireAuth(), async (c) => {
  const { projectId, deckId } = c.req.param();
  const body = await c.req.json<{ label: string }>();
  if (!body.label) return c.json({ success: false, err: "label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await updateSlideDeckLabel(projectDb, deckId, body.label);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeck.put("/projects/:projectId/slide_decks/:deckId/plan", requireAuth(), async (c) => {
  const { projectId, deckId } = c.req.param();
  const body = await c.req.json<{ plan: string }>();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await updateSlideDeckPlan(projectDb, deckId, body.plan ?? "");
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeck.put("/projects/:projectId/slide_decks/:deckId/config", requireAuth(), async (c) => {
  const { projectId, deckId } = c.req.param();
  const body = await c.req.json<{ config: SlideDeckConfig }>();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await updateSlideDeckConfig(projectDb, deckId, body.config);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeck.put("/projects/:projectId/slide_decks/:deckId/folder", requireAuth(), async (c) => {
  const { projectId, deckId } = c.req.param();
  const body = await c.req.json<{ folderId: string | null }>();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await moveSlideDeckToFolder(projectDb, deckId, body.folderId);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeck.post("/projects/:projectId/slide_decks/:deckId/duplicate", requireAuth(), async (c) => {
  const { projectId, deckId } = c.req.param();
  const body = await c.req.json<{ label: string; folderId?: string | null }>();
  if (!body.label) return c.json({ success: false, err: "label required" }, 400);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await duplicateSlideDeck(projectDb, deckId, body.label, body.folderId);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeck.delete("/projects/:projectId/slide_decks/:deckId", requireAuth(), async (c) => {
  const { projectId, deckId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await deleteSlideDeck(projectDb, deckId);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

// ─── Slides ───────────────────────────────────────────────────────────────────

routesSlideDeck.get("/projects/:projectId/slide_decks/:deckId/slides", requireAuth(), async (c) => {
  const { projectId, deckId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getSlides(projectDb, deckId);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeck.get("/projects/:projectId/slides/:slideId", requireAuth(), async (c) => {
  const { projectId, slideId } = c.req.param();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");
  const result = await getSlide(projectDb, slideId);
  if (!result.success) return c.json(result, 404);
  return c.json(result);
});

routesSlideDeck.post("/projects/:projectId/slide_decks/:deckId/slides", requireAuth(), async (c) => {
  const { projectId, deckId } = c.req.param();
  const body = await c.req.json<{ slide: Slide; position: SlidePosition }>();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await createSlide(projectDb, deckId, body.position, body.slide);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeck.put("/projects/:projectId/slides/:slideId", requireAuth(), async (c) => {
  const { projectId, slideId } = c.req.param();
  const body = await c.req.json<{ slide: Slide }>();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await updateSlide(projectDb, slideId, body.slide);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeck.delete("/projects/:projectId/slide_decks/:deckId/slides", requireAuth(), async (c) => {
  const { projectId, deckId } = c.req.param();
  const body = await c.req.json<{ slideIds: string[] }>();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await deleteSlides(projectDb, deckId, body.slideIds);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeck.post("/projects/:projectId/slide_decks/:deckId/slides/duplicate", requireAuth(), async (c) => {
  const { projectId, deckId } = c.req.param();
  const body = await c.req.json<{ slideIds: string[] }>();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await duplicateSlides(projectDb, deckId, body.slideIds);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

routesSlideDeck.put("/projects/:projectId/slide_decks/:deckId/slides/move", requireAuth(), async (c) => {
  const { projectId, deckId } = c.req.param();
  const body = await c.req.json<{ slideIds: string[]; position: SlidePosition }>();
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  const result = await moveSlides(projectDb, deckId, body.slideIds, body.position);
  if (!result.success) return c.json(result, 500);
  return c.json(result);
});

