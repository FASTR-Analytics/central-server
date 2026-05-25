import type { Hono } from "hono";
import { serveStatic } from "hono/deno";

export function setupStaticServing(app: Hono) {
  app.use("*", serveStatic({ root: "./client_dist" }));
}
