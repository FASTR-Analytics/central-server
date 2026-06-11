import { Hono } from "hono";
import type { GlobalUser, ProjectUserPermissions } from "lib";
import { nanoid } from "nanoid";
import {
  getPgConnectionFromCacheOrNew,
  getResultsObjectTableName,
  initProjectDb,
  type DBProject,
} from "../../db/mod.ts";
import {
  getImportHistory,
  getProjectPermissions as getProjectPermissionsDb,
  getProjectRow,
  getProjectUsers,
} from "../../db/instance/projects.ts";
import { requireAuth } from "../../middleware/auth.ts";
import { notifyInstanceProjectsLastUpdated } from "../../task_management/notify_instance_updated.ts";
import { notifyProjectConfigUpdated } from "../../task_management/notify_project_v2.ts";
import {
  refetchAndNotifyImportHistory,
  refetchAndNotifyProjectUsers,
} from "../../task_management/refetch_and_notify.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export const routesProjects = new Hono<Env>();

function getProjectPermissions(
  email: string,
  projectId: string,
  isAdmin: boolean,
): Promise<ProjectUserPermissions> {
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");
  return getProjectPermissionsDb(mainDb, email, projectId, isAdmin);
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

  const project = await getProjectRow(mainDb, projectId);
  if (!project) return c.json({ success: false, err: "Not found" }, 404);

  const perms = await getProjectPermissions(user.email, projectId, user.isAdmin);

  // Only show history if user can view data
  const importHistory = (perms.can_view_data || perms.can_configure_data)
    ? await getImportHistory(mainDb, projectId)
    : [];

  // Only load project users if user can manage them
  const projectUsers = perms.can_configure_users
    ? await getProjectUsers(mainDb, projectId)
    : [];

  return c.json({
    success: true,
    data: {
      id: project.id,
      label: project.label,
      isLocked: project.is_locked,
      status: project.status,
      createdAt: project.created_at.toISOString(),
      importHistory,
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

  const postgresDb = getPgConnectionFromCacheOrNew("postgres", "READ_AND_WRITE");
  await postgresDb.unsafe(`CREATE DATABASE "${projectId.replace(/"/g, "")}"`);
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");
  await initProjectDb(projectDb);

  notifyInstanceProjectsLastUpdated();
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
  const result = await mainDb<{ id: string; is_locked: boolean }[]>`
    UPDATE projects SET label = ${label.trim()} WHERE id = ${projectId} RETURNING id, is_locked
  `;
  const updated = result.at(0);
  if (!updated) return c.json({ success: false, err: "Not found" }, 404);
  notifyProjectConfigUpdated(projectId, label.trim(), updated.is_locked);
  notifyInstanceProjectsLastUpdated();
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
  const result = await mainDb<{ id: string; label: string }[]>`
    UPDATE projects SET is_locked = ${lockAction === "lock"} WHERE id = ${projectId} RETURNING id, label
  `;
  const updated = result.at(0);
  if (!updated) return c.json({ success: false, err: "Not found" }, 404);
  notifyProjectConfigUpdated(projectId, updated.label, lockAction === "lock");
  notifyInstanceProjectsLastUpdated();
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
  notifyInstanceProjectsLastUpdated();
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
    can_view_slide_decks: boolean;
    can_configure_slide_decks: boolean;
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
      can_view_data, can_configure_visualizations, can_view_visualizations,
      can_view_slide_decks, can_configure_slide_decks
    ) VALUES (
      ${targetEmail}, ${projectId},
      ${body.can_configure_settings ?? false},
      ${body.can_configure_users ?? false},
      ${body.can_configure_data ?? false},
      ${body.can_view_data ?? false},
      ${body.can_configure_visualizations ?? false},
      ${body.can_view_visualizations ?? false},
      ${body.can_view_slide_decks ?? false},
      ${body.can_configure_slide_decks ?? false}
    )
    ON CONFLICT (email, project_id) DO UPDATE SET
      can_configure_settings = EXCLUDED.can_configure_settings,
      can_configure_users = EXCLUDED.can_configure_users,
      can_configure_data = EXCLUDED.can_configure_data,
      can_view_data = EXCLUDED.can_view_data,
      can_configure_visualizations = EXCLUDED.can_configure_visualizations,
      can_view_visualizations = EXCLUDED.can_view_visualizations,
      can_view_slide_decks = EXCLUDED.can_view_slide_decks,
      can_configure_slide_decks = EXCLUDED.can_configure_slide_decks
  `;
  await refetchAndNotifyProjectUsers(mainDb, projectId);
  notifyInstanceProjectsLastUpdated();
  return c.json({ success: true });
});

// Get a specific user's permissions on a project (requires can_configure_users or self)
routesProjects.get("/projects/:id/users/:email", requireAuth(), async (c) => {
  const projectId = c.req.param("id");
  const targetEmail = c.req.param("email");
  const user = c.get("globalUser");
  const perms = await getProjectPermissions(user.email, projectId, user.isAdmin);
  if (!perms.can_configure_users && user.email !== targetEmail) {
    return c.json({ success: false, err: "Not authorized" }, 403);
  }
  const targetPerms = await getProjectPermissions(targetEmail, projectId, false);
  return c.json({ success: true, data: targetPerms });
});

// Delete all data for a source server from a project (requires can_configure_data)
routesProjects.delete("/projects/:id/data/:sourceServerId", requireAuth(), async (c) => {
  const projectId = c.req.param("id");
  const sourceServerId = c.req.param("sourceServerId");
  const user = c.get("globalUser");
  const perms = await getProjectPermissions(user.email, projectId, user.isAdmin);
  if (!perms.can_configure_data) {
    return c.json({ success: false, err: "Not authorized" }, 403);
  }

  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_AND_WRITE");

  type RORow = { id: string };
  const resultsObjects = await projectDb<RORow[]>`SELECT id FROM results_objects`;

  for (const ro of resultsObjects) {
    const tableName = getResultsObjectTableName(ro.id);
    const tableExists = await projectDb<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = ${tableName}
      ) AS exists
    `;
    if (tableExists.at(0)?.exists) {
      await projectDb.unsafe(`DELETE FROM ${tableName} WHERE source_server_id = $1`, [sourceServerId]);
    }
  }

  await mainDb`
    UPDATE import_history
    SET status = 'deleted'
    WHERE target_project_id = ${projectId} AND source_server_id = ${sourceServerId}
  `;

  await refetchAndNotifyImportHistory(mainDb, projectId);
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
  await refetchAndNotifyProjectUsers(mainDb, projectId);
  notifyInstanceProjectsLastUpdated();
  return c.json({ success: true });
});
