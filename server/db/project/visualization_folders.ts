import type { Sql } from "postgres";
import type { VisualizationFolder } from "platform-lib";
import { tryCatchDatabaseAsync } from "../utils.ts";
import type { APIResponseWithData } from "../utils.ts";
import type { DBVisualizationFolder } from "./_project_database_types.ts";

export async function getAllVisualizationFolders(
  projectDb: Sql,
): Promise<APIResponseWithData<VisualizationFolder[]>> {
  return await tryCatchDatabaseAsync(async () => {
    const rows = await projectDb<DBVisualizationFolder[]>`
      SELECT * FROM visualization_folders ORDER BY sort_order, LOWER(label)
    `;
    const folders = rows.map<VisualizationFolder>((row) => ({
      id: row.id,
      label: row.label,
      color: row.color,
      description: row.description,
      sortOrder: row.sort_order,
    }));
    return { success: true, data: folders };
  });
}

export async function createVisualizationFolder(
  projectDb: Sql,
  label: string,
  color?: string,
  description?: string,
): Promise<APIResponseWithData<{ folderId: string; lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const folderId = crypto.randomUUID();
    const lastUpdated = new Date().toISOString();

    const maxOrder = await projectDb<{ max: number | null }[]>`
      SELECT MAX(sort_order) as max FROM visualization_folders
    `;
    const sortOrder = (maxOrder[0]?.max ?? -1) + 1;

    await projectDb`
      INSERT INTO visualization_folders (id, label, color, description, sort_order, last_updated)
      VALUES (${folderId}, ${label.trim()}, ${color ?? null}, ${description ?? null}, ${sortOrder}, ${lastUpdated})
    `;
    return { success: true, data: { folderId, lastUpdated } };
  });
}

export async function updateVisualizationFolder(
  projectDb: Sql,
  folderId: string,
  label: string,
  color?: string | null,
  description?: string | null,
): Promise<APIResponseWithData<{ lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const lastUpdated = new Date().toISOString();
    await projectDb`
      UPDATE visualization_folders
      SET label = ${label.trim()}, color = ${color ?? null}, description = ${description ?? null}, last_updated = ${lastUpdated}
      WHERE id = ${folderId}
    `;
    return { success: true, data: { lastUpdated } };
  });
}

export async function deleteVisualizationFolder(
  projectDb: Sql,
  folderId: string,
): Promise<APIResponseWithData<{ lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const lastUpdated = new Date().toISOString();
    await projectDb`DELETE FROM visualization_folders WHERE id = ${folderId}`;
    return { success: true, data: { lastUpdated } };
  });
}
