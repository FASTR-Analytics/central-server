import type { Sql } from "postgres";
import { nanoid } from "nanoid";
import type { DBPresentationObject } from "./_project_database_types.ts";

export type PresentationObjectSummary = {
  id: string;
  metricId: string;
  label: string;
  type: string;
  folderId: string | null;
  sortOrder: number;
  lastUpdated: string;
};

export type PresentationObjectDetail = {
  id: string;
  metricId: string;
  label: string;
  config: unknown;
  folderId: string | null;
  sortOrder: number;
  lastUpdated: string;
};

function extractType(configJson: string): string {
  try {
    const parsed = JSON.parse(configJson);
    return parsed?.d?.type ?? "unknown";
  } catch {
    return "unknown";
  }
}

function rowToSummary(row: DBPresentationObject): PresentationObjectSummary {
  return {
    id: row.id,
    metricId: row.metric_id,
    label: row.label,
    type: extractType(row.config),
    folderId: row.folder_id,
    sortOrder: row.sort_order,
    lastUpdated: row.last_updated,
  };
}

function rowToDetail(row: DBPresentationObject): PresentationObjectDetail {
  let config: unknown = {};
  try {
    config = JSON.parse(row.config);
  } catch { /* empty */ }
  return {
    id: row.id,
    metricId: row.metric_id,
    label: row.label,
    config,
    folderId: row.folder_id,
    sortOrder: row.sort_order,
    lastUpdated: row.last_updated,
  };
}

export async function addPresentationObject(
  projectDb: Sql,
  metricId: string,
  label: string,
  config: unknown,
): Promise<{ success: true; data: { id: string } } | { success: false; err: string }> {
  try {
    const id = nanoid();
    const configStr = typeof config === "string" ? config : JSON.stringify(config);
    const lastUpdated = new Date().toISOString();
    await projectDb`
      INSERT INTO presentation_objects (id, metric_id, label, config, last_updated)
      VALUES (${id}, ${metricId}, ${label}, ${configStr}, ${lastUpdated})
    `;
    return { success: true, data: { id } };
  } catch (err) {
    return { success: false, err: err instanceof Error ? err.message : String(err) };
  }
}

export async function getAllPresentationObjectsForProject(
  projectDb: Sql,
): Promise<{ success: true; data: PresentationObjectSummary[] } | { success: false; err: string }> {
  try {
    const rows = await projectDb<DBPresentationObject[]>`
      SELECT * FROM presentation_objects ORDER BY sort_order, label
    `;
    return { success: true, data: rows.map(rowToSummary) };
  } catch (err) {
    return { success: false, err: err instanceof Error ? err.message : String(err) };
  }
}

export async function getPresentationObjectDetail(
  projectDb: Sql,
  id: string,
): Promise<{ success: true; data: PresentationObjectDetail } | { success: false; err: string }> {
  try {
    const row = (await projectDb<DBPresentationObject[]>`
      SELECT * FROM presentation_objects WHERE id = ${id}
    `).at(0);
    if (!row) return { success: false, err: "Not found" };
    return { success: true, data: rowToDetail(row) };
  } catch (err) {
    return { success: false, err: err instanceof Error ? err.message : String(err) };
  }
}

export async function updatePresentationObjectLabel(
  projectDb: Sql,
  id: string,
  label: string,
): Promise<{ success: true } | { success: false; err: string }> {
  try {
    const result = await projectDb<{ id: string }[]>`
      UPDATE presentation_objects SET label = ${label} WHERE id = ${id} RETURNING id
    `;
    if (!result.at(0)) return { success: false, err: "Not found" };
    return { success: true };
  } catch (err) {
    return { success: false, err: err instanceof Error ? err.message : String(err) };
  }
}

export async function updatePresentationObjectConfig(
  projectDb: Sql,
  id: string,
  config: unknown,
): Promise<{ success: true } | { success: false; err: string }> {
  try {
    const configStr = typeof config === "string" ? config : JSON.stringify(config);
    const lastUpdated = new Date().toISOString();
    const result = await projectDb<{ id: string }[]>`
      UPDATE presentation_objects
      SET config = ${configStr}, last_updated = ${lastUpdated}
      WHERE id = ${id}
      RETURNING id
    `;
    if (!result.at(0)) return { success: false, err: "Not found" };
    return { success: true };
  } catch (err) {
    return { success: false, err: err instanceof Error ? err.message : String(err) };
  }
}

export async function deletePresentationObject(
  projectDb: Sql,
  id: string,
): Promise<{ success: true } | { success: false; err: string }> {
  try {
    await projectDb`DELETE FROM presentation_objects WHERE id = ${id}`;
    return { success: true };
  } catch (err) {
    return { success: false, err: err instanceof Error ? err.message : String(err) };
  }
}

export async function duplicatePresentationObject(
  projectDb: Sql,
  id: string,
  label: string,
  folderId?: string | null,
): Promise<{ success: true; data: { id: string } } | { success: false; err: string }> {
  try {
    const source = (await projectDb<DBPresentationObject[]>`
      SELECT * FROM presentation_objects WHERE id = ${id}
    `).at(0);
    if (!source) return { success: false, err: "Not found" };

    const newId = nanoid();
    const lastUpdated = new Date().toISOString();
    const newFolderId = folderId === undefined ? source.folder_id : folderId;
    await projectDb`
      INSERT INTO presentation_objects (id, metric_id, label, config, last_updated, folder_id, sort_order)
      VALUES (${newId}, ${source.metric_id}, ${label}, ${source.config}, ${lastUpdated}, ${newFolderId}, ${source.sort_order})
    `;
    return { success: true, data: { id: newId } };
  } catch (err) {
    return { success: false, err: err instanceof Error ? err.message : String(err) };
  }
}

export async function updatePresentationObjectFolder(
  projectDb: Sql,
  presentationObjectId: string,
  folderId: string | null,
): Promise<{ success: true; data: { lastUpdated: string } } | { success: false; err: string }> {
  try {
    const lastUpdated = new Date().toISOString();
    await projectDb`
      UPDATE presentation_objects
      SET folder_id = ${folderId}, last_updated = ${lastUpdated}
      WHERE id = ${presentationObjectId}
    `;
    return { success: true, data: { lastUpdated } };
  } catch (err) {
    return { success: false, err: err instanceof Error ? err.message : String(err) };
  }
}
