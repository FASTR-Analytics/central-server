import type { Sql } from "postgres";
import type { ImportHistoryEntry, ProjectUser, ProjectUserPermissions } from "lib";
import {
  _PROJECT_USER_PERMISSIONS_NO_ACCESS,
  _PROJECT_USER_PERMISSIONS_FULL_ACCESS,
} from "lib";
import type { DBImportHistory, DBProject, DBProjectUserRole } from "./_main_database_types.ts";

export async function getProjectPermissions(
  mainDb: Sql,
  email: string,
  projectId: string,
  isAdmin: boolean,
): Promise<ProjectUserPermissions> {
  if (isAdmin) return _PROJECT_USER_PERMISSIONS_FULL_ACCESS;
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
    can_view_slide_decks: row.can_view_slide_decks,
    can_configure_slide_decks: row.can_configure_slide_decks,
  };
}

export async function getProjectRow(
  mainDb: Sql,
  projectId: string,
): Promise<DBProject | undefined> {
  const rows = await mainDb<DBProject[]>`SELECT * FROM projects WHERE id = ${projectId}`;
  return rows.at(0);
}

export async function getImportHistory(
  mainDb: Sql,
  projectId: string,
): Promise<ImportHistoryEntry[]> {
  const rows = await mainDb<DBImportHistory[]>`
    SELECT * FROM import_history WHERE target_project_id = ${projectId} ORDER BY imported_at DESC
  `;
  return rows.map((h) => ({
    id: h.id,
    sourceServerId: h.source_server_id,
    sourceServerLabel: h.source_server_label,
    sourceProjectId: h.source_project_id,
    importedAt: h.imported_at.toISOString(),
    importedBy: h.imported_by,
    nResultsObjects: h.n_results_objects,
    nRowsTotal: h.n_rows_total,
    status: h.status as ImportHistoryEntry["status"],
  }));
}

export async function getProjectUsers(
  mainDb: Sql,
  projectId: string,
): Promise<ProjectUser[]> {
  type JoinRow = DBProjectUserRole & { first_name: string | null; last_name: string | null; is_admin: boolean };
  const rows = await mainDb<JoinRow[]>`
    SELECT pur.*, u.first_name, u.last_name, u.is_admin
    FROM project_user_roles pur
    JOIN users u ON pur.email = u.email
    WHERE pur.project_id = ${projectId}
    ORDER BY pur.email
  `;
  return rows.map((row) => ({
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
    can_view_slide_decks: row.can_view_slide_decks,
    can_configure_slide_decks: row.can_configure_slide_decks,
  }));
}
