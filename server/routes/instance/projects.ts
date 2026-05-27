import { Hono } from "hono";
import type { GlobalUser, ProjectUserPermissions, ProjectUser } from "lib";
import {
  _PROJECT_USER_PERMISSIONS_NO_ACCESS,
  _PROJECT_USER_PERMISSIONS_FULL_ACCESS,
} from "lib";
import { nanoid } from "nanoid";
import {
  getPgConnectionFromCacheOrNew,
  initProjectDb,
  type DBProject,
  type DBImportHistory,
  type DBProjectUserRole,
  type DBUser,
} from "../../db/mod.ts";
import { requireAuth, requireHUser } from "../../middleware/auth.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export const routesProjects = new Hono<Env>();

async function getProjectPermissions(
  email: string,
  projectId: string,
  isAdmin: boolean,
): Promise<ProjectUserPermissions> {
  if (isAdmin) return _PROJECT_USER_PERMISSIONS_FULL_ACCESS;
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");
  const rows = await mainDb<DBProjectUserRole[]>`
    SELECT * FROM project_user_roles WHERE email = ${email} AND project_id = ${projectId}
  `;
  const row = rows.at(0);
  if (!row) return _PROJECT_USER_PERMISSIONS_NO_ACCESS;
  return {
    can_configure_settings: row.can_configure_settings,
    can_configure_users: row.can_configure_users,
    can_configure_data: row.can_configure_data,
    can_view_data: row.can_view_data,
    can_configure_visualizations: row.can_configure_visualizations,
    can_view_visualizations: row.can_view_visualizations,
  };
}

// List projects — admins see all; others see only their projects
routesProjects.get("/projects", requireAuth(), async (c) => {
  const user = c.get("globalUser");
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");

  let projects: DBProject[];
  if (user.isAdmin) {
    projects = await mainDb<DBProject[]>`
      SELECT * FROM projects WHERE status != 'pending_deletion' ORDER BY label
    `;
  } else {
    projects = await mainDb<DBProject[]>`
      SELECT p.* FROM projects p
      JOIN project_user_roles pur ON p.id = pur.project_id
      WHERE pur.email = ${user.email} AND p.status != 'pending_deletion'
      ORDER BY p.label
    `;
  }

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

// Get single project with import history + permissions
routesProjects.get("/projects/:id", requireAuth(), async (c) => {
  const projectId = c.req.param("id");
  const user = c.get("globalUser");
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");

  const projectRow = await mainDb<DBProject[]>`SELECT * FROM projects WHERE id = ${projectId}`;
  const project = projectRow.at(0);
  if (!project) return c.json({ success: false, err: "Not found" }, 404);

  const perms = await getProjectPermissions(user.email, projectId, user.isAdmin);

  // Only show history if user can view data
  const history = (perms.can_view_data || perms.can_configure_data)
    ? await mainDb<DBImportHistory[]>`
        SELECT * FROM import_history WHERE target_project_id = ${projectId} ORDER BY imported_at DESC
      `
    : [];

  // Only load project users if user can manage them
  let projectUsers: ProjectUser[] = [];
  if (perms.can_configure_users) {
    type JoinRow = DBProjectUserRole & { first_name: string | null; last_name: string | null; is_admin: boolean };
    const rows = await mainDb<JoinRow[]>`
      SELECT pur.*, u.first_name, u.last_name, u.is_admin
      FROM project_user_roles pur
      JOIN users u ON pur.email = u.email
      WHERE pur.project_id = ${projectId}
      ORDER BY pur.email
    `;
    projectUsers = rows.map((row) => ({
      email: row.email,
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      isAdmin: row.is_admin,
      can_configure_settings: row.can_configure_settings,
      can_configure_users: row.can_configure_users,
      can_configure_data: row.can_configure_data,
      can_view_data: row.can_view_data,
      can_configure_visualizations: row.can_configure_visualizations,
      can_view_visualizations: row.can_view_visualizations,
    }));
  }

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
      thisUserPermissions: perms,
      projectUsers,
    },
  });
});

// Create project (admin or canCreateProjects)
routesProjects.post("/projects", requireAuth(), async (c) => {
  const user = c.get("globalUser");
  if (!user.canCreateProjects) {
    return c.json({ success: false, err: "Not authorized to create projects" }, 403);
  }
  const { label } = await c.req.json<{ label: string }>();
  if (!label?.trim()) return c.json({ success: false, err: "Label required" }, 400);

  const projectId = nanoid();
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");
  await mainDb`INSERT INTO projects (id, label) VALUES (${projectId}, ${label.trim()})`;

  // Give the creator full access to their project
  if (!user.isAdmin) {
    await mainDb`
      INSERT INTO project_user_roles (email, project_id,
        can_configure_settings, can_configure_users, can_configure_data,
        can_view_data, can_configure_visualizations, can_view_visualizations)
      VALUES (${user.email}, ${projectId}, true, true, true, true, true, true)
      ON CONFLICT DO NOTHING
    `;
  }

  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  await initProjectDb(projectDb);

  return c.json({ success: true, data: { id: projectId } });
});

// Update project label (requires can_configure_settings)
routesProjects.put("/projects/:id", requireAuth(), async (c) => {
  const projectId = c.req.param("id");
  const user = c.get("globalUser");
  const perms = await getProjectPermissions(user.email, projectId, user.isAdmin);
  if (!perms.can_configure_settings) {
    return c.json({ success: false, err: "Not authorized" }, 403);
  }
  const { label } = await c.req.json<{ label: string }>();
  if (!label?.trim()) return c.json({ success: false, err: "Label required" }, 400);
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");
  const result = await mainDb<{ id: string }[]>`
    UPDATE projects SET label = ${label.trim()} WHERE id = ${projectId} RETURNING id
  `;
  if (!result.at(0)) return c.json({ success: false, err: "Not found" }, 404);
  return c.json({ success: true });
});

// Lock / unlock project (requires can_configure_settings)
routesProjects.post("/projects/:id/lock", requireAuth(), async (c) => {
  const projectId = c.req.param("id");
  const user = c.get("globalUser");
  const perms = await getProjectPermissions(user.email, projectId, user.isAdmin);
  if (!perms.can_configure_settings) {
    return c.json({ success: false, err: "Not authorized" }, 403);
  }
  const { lockAction } = await c.req.json<{ lockAction: "lock" | "unlock" }>();
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");
  const result = await mainDb<{ id: string }[]>`
    UPDATE projects SET is_locked = ${lockAction === "lock"} WHERE id = ${projectId} RETURNING id
  `;
  if (!result.at(0)) return c.json({ success: false, err: "Not found" }, 404);
  return c.json({ success: true, data: { isLocked: lockAction === "lock" } });
});

// Delete project (requires can_configure_settings)
routesProjects.delete("/projects/:id", requireAuth(), async (c) => {
  const projectId = c.req.param("id");
  const user = c.get("globalUser");
  const perms = await getProjectPermissions(user.email, projectId, user.isAdmin);
  if (!perms.can_configure_settings) {
    return c.json({ success: false, err: "Not authorized" }, 403);
  }
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

// Set project user permissions (requires can_configure_users for the project)
routesProjects.put("/projects/:id/users/:email", requireAuth(), async (c) => {
  const projectId = c.req.param("id");
  const targetEmail = c.req.param("email");
  const user = c.get("globalUser");
  const perms = await getProjectPermissions(user.email, projectId, user.isAdmin);
  if (!perms.can_configure_users) {
    return c.json({ success: false, err: "Not authorized" }, 403);
  }

  const body = await c.req.json<Partial<{
    can_configure_settings: boolean;
    can_configure_users: boolean;
    can_configure_data: boolean;
    can_view_data: boolean;
    can_configure_visualizations: boolean;
    can_view_visualizations: boolean;
  }>>();

  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");

  // Ensure the target user exists in the users table first
  const userExists = await mainDb<{ email: string }[]>`
    SELECT email FROM users WHERE email = ${targetEmail}
  `;
  if (!userExists.length) {
    return c.json({ success: false, err: "User not found. Add them to the instance first." }, 404);
  }

  await mainDb`
    INSERT INTO project_user_roles (
      email, project_id,
      can_configure_settings, can_configure_users, can_configure_data,
      can_view_data, can_configure_visualizations, can_view_visualizations
    ) VALUES (
      ${targetEmail}, ${projectId},
      ${body.can_configure_settings ?? false},
      ${body.can_configure_users ?? false},
      ${body.can_configure_data ?? false},
      ${body.can_view_data ?? false},
      ${body.can_configure_visualizations ?? false},
      ${body.can_view_visualizations ?? false}
    )
    ON CONFLICT (email, project_id) DO UPDATE SET
      can_configure_settings = EXCLUDED.can_configure_settings,
      can_configure_users = EXCLUDED.can_configure_users,
      can_configure_data = EXCLUDED.can_configure_data,
      can_view_data = EXCLUDED.can_view_data,
      can_configure_visualizations = EXCLUDED.can_configure_visualizations,
      can_view_visualizations = EXCLUDED.can_view_visualizations
  `;
  return c.json({ success: true });
});

// Remove user from project (requires can_configure_users)
routesProjects.delete("/projects/:id/users/:email", requireAuth(), async (c) => {
  const projectId = c.req.param("id");
  const targetEmail = c.req.param("email");
  const user = c.get("globalUser");
  const perms = await getProjectPermissions(user.email, projectId, user.isAdmin);
  if (!perms.can_configure_users) {
    return c.json({ success: false, err: "Not authorized" }, 403);
  }
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");
  await mainDb`DELETE FROM project_user_roles WHERE email = ${targetEmail} AND project_id = ${projectId}`;
  return c.json({ success: true });
});
