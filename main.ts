import { Hono } from "hono";
import { dbStartUp } from "./server/db/mod.ts";

import { authMiddleware, corsMiddleware, setupStaticServing } from "./server/middleware/mod.ts";
import { routesHealth } from "./server/routes/instance/health.ts";
import { routesProjects } from "./server/routes/instance/projects.ts";
import { routesImport } from "./server/routes/instance/import.ts";
import { routesCentral } from "./server/routes/instance/central.ts";
import { routesPresentationObjects } from "./server/routes/project/presentation_objects.ts";

await dbStartUp();

const app = new Hono();

// @ts-ignore - Clerk middleware types
app.use("*", authMiddleware);
app.use("*", corsMiddleware);

app.onError((err, c) => {
  console.error(err);
  return c.json({ success: false, err: err instanceof Error ? err.message : "Server error" });
});

app.route("/", routesHealth);
app.route("/", routesProjects);
app.route("/", routesImport);
app.route("/", routesCentral);
app.route("/", routesPresentationObjects);

setupStaticServing(app);

app.get("*", (c) => c.redirect("/", 302));

const port = parseInt(Deno.env.get("PORT") || "8000");
const server = Deno.serve({ port }, app.fetch);

const shutdown = async () => {
  console.log("\nShutting down...");
  setTimeout(() => {
    console.warn("[Shutdown] Timed out — forcing exit");
    Deno.exit(1);
  }, 8000);
  await server.shutdown();
  Deno.exit(0);
};
Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);
