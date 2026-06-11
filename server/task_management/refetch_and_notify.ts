import type { Sql } from "postgres";
import { getImportHistory, getProjectUsers } from "../db/instance/projects.ts";
import { getProjectMetrics } from "../db/project/metrics.ts";
import { getAllPresentationObjectsForProject } from "../db/project/presentation_objects.ts";
import { getAllVisualizationFolders } from "../db/project/visualization_folders.ts";
import { getAllSlideDecks } from "../db/project/slide_decks.ts";
import { getAllSlideDeckFolders } from "../db/project/slide_deck_folders.ts";
import {
  notifyProjectImportHistoryUpdated,
  notifyProjectMetricsUpdated,
  notifyProjectSlideDeckFoldersUpdated,
  notifyProjectSlideDecksUpdated,
  notifyProjectUsersUpdated,
  notifyProjectVisualizationFoldersUpdated,
  notifyProjectVisualizationsUpdated,
} from "./notify_project_v2.ts";

// Post-mutation refetch + broadcast. A failed refetch must never be silent —
// it strands connected clients on stale state.

export async function refetchAndNotifyVisualizations(
  projectDb: Sql,
  projectId: string,
): Promise<void> {
  const res = await getAllPresentationObjectsForProject(projectDb);
  if (res.success) notifyProjectVisualizationsUpdated(projectId, res.data);
  else console.error("post-mutation visualizations refetch failed:", res.err);
}

export async function refetchAndNotifyVisualizationFolders(
  projectDb: Sql,
  projectId: string,
): Promise<void> {
  const res = await getAllVisualizationFolders(projectDb);
  if (res.success) notifyProjectVisualizationFoldersUpdated(projectId, res.data);
  else console.error("post-mutation visualization folders refetch failed:", res.err);
}

export async function refetchAndNotifySlideDecks(
  projectDb: Sql,
  projectId: string,
): Promise<void> {
  const res = await getAllSlideDecks(projectDb);
  if (res.success) notifyProjectSlideDecksUpdated(projectId, res.data);
  else console.error("post-mutation slide decks refetch failed:", res.err);
}

export async function refetchAndNotifySlideDeckFolders(
  projectDb: Sql,
  projectId: string,
): Promise<void> {
  const res = await getAllSlideDeckFolders(projectDb);
  if (res.success) notifyProjectSlideDeckFoldersUpdated(projectId, res.data);
  else console.error("post-mutation slide deck folders refetch failed:", res.err);
}

export async function refetchAndNotifyMetrics(
  projectDb: Sql,
  projectId: string,
): Promise<void> {
  const res = await getProjectMetrics(projectDb);
  if (res.success) notifyProjectMetricsUpdated(projectId, res.data);
  else console.error("post-mutation metrics refetch failed:", res.err);
}

export async function refetchAndNotifyProjectUsers(
  mainDb: Sql,
  projectId: string,
): Promise<void> {
  try {
    const projectUsers = await getProjectUsers(mainDb, projectId);
    notifyProjectUsersUpdated(projectId, projectUsers);
  } catch (e) {
    console.error("post-mutation project users refetch failed:", e);
  }
}

export async function refetchAndNotifyImportHistory(
  mainDb: Sql,
  projectId: string,
): Promise<void> {
  try {
    const importHistory = await getImportHistory(mainDb, projectId);
    notifyProjectImportHistoryUpdated(projectId, importHistory);
  } catch (e) {
    console.error("post-mutation import history refetch failed:", e);
  }
}
