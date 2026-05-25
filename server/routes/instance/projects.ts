import { Hono } from "hono";
import type { GlobalUser } from "lib";
import { nanoid } from "nanoid";
import { getPgConnectionFromCacheOrNew, initProjectDb, type DBProject, type DBImportHistory } from "../../db/mod.ts";
import { requireAuth, requireHUser } from "../../middleware/auth.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export const routesProjects = new Hono<Env>();

// List all projects (any authenticated user)
routesProjects.get("/projects", requireAuth(), async (c) => {
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");
  const projects = await mainDb<DBProject[]>`
    SELECT * FROM projects ORDER BY label
  `;
  return c.json({
    success: true,
    data: projects.map((p) => ({
      id: p.id,
      label: p.label,
      isLocked: p.is_locked,
      status: p.status,
      createdAt: p.created_at.toISOString(),
    })),
  });
});

// Get single project with import history (any authenticated user)
routesProjects.get("/projects/:id", requireAuth(), async (c) => {
  const projectId = c.req.param("id");
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");

  const projectRow = await mainDb<DBProject[]>`SELECT * FROM projects WHERE id = ${projectId}`;
  const project = projectRow.at(0);
  if (!project) return c.json({ success: false, err: "Not found" }, 404);

  const history = await mainDb<DBImportHistory[]>`
    SELECT * FROM import_history WHERE target_project_id = ${projectId} ORDER BY imported_at DESC
  `;

  return c.json({
    success: true,
    data: {
      id: project.id,
      label: project.label,
      isLocked: project.is_locked,
      status: project.status,
      createdAt: project.created_at.toISOString(),
      importHistory: history.map((h) => ({
        id: h.id,
        sourceServerId: h.source_server_id,
        sourceServerLabel: h.source_server_label,
        sourceProjectId: h.source_project_id,
        importedAt: h.imported_at.toISOString(),
        importedBy: h.imported_by,
        nResultsObjects: h.n_results_objects,
        nRowsTotal: h.n_rows_total,
        status: h.status,
      })),
    },
  });
});

// Create project (h_user only)
routesProjects.post("/projects", requireHUser(), async (c) => {
  const { label } = await c.req.json<{ label: string }>();
  if (!label?.trim()) return c.json({ success: false, err: "Label required" }, 400);

  const projectId = nanoid();
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");

  await mainDb`INSERT INTO projects (id, label) VALUES (${projectId}, ${label.trim()})`;

  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  await initProjectDb(projectDb);

  return c.json({ success: true, data: { id: projectId } });
});

// Update project label (h_user only)
routesProjects.put("/projects/:id", requireHUser(), async (c) => {
  const projectId = c.req.param("id");
  const { label } = await c.req.json<{ label: string }>();
  if (!label?.trim()) return c.json({ success: false, err: "Label required" }, 400);

  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");
  const result = await mainDb<{ id: string }[]>`
    UPDATE projects SET label = ${label.trim()} WHERE id = ${projectId} RETURNING id
  `;
  if (!result.at(0)) return c.json({ success: false, err: "Not found" }, 404);
  return c.json({ success: true });
});

// Lock / unlock project (h_user only)
routesProjects.post("/projects/:id/lock", requireHUser(), async (c) => {
  const projectId = c.req.param("id");
  const { lockAction } = await c.req.json<{ lockAction: "lock" | "unlock" }>();

  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");
  const result = await mainDb<{ id: string }[]>`
    UPDATE projects SET is_locked = ${lockAction === "lock"} WHERE id = ${projectId} RETURNING id
  `;
  if (!result.at(0)) return c.json({ success: false, err: "Not found" }, 404);
  return c.json({ success: true, data: { isLocked: lockAction === "lock" } });
});

// Delete project (h_user only, soft delete)
routesProjects.delete("/projects/:id", requireHUser(), async (c) => {
  const projectId = c.req.param("id");
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");

  const result = await mainDb<{ id: string }[]>`
    UPDATE projects
    SET status = 'pending_deletion', deletion_scheduled_at = NOW() + INTERVAL '30 days'
    WHERE id = ${projectId}
    RETURNING id
  `;
  if (!result.at(0)) return c.json({ success: false, err: "Not found" }, 404);
  return c.json({ success: true });
});
