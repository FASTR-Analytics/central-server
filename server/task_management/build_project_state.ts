import type { Sql } from "postgres";
import type { GlobalUser, ProjectState } from "lib";
import type { APIResponseWithData } from "../db/utils.ts";
import {
  getImportHistory,
  getProjectPermissions,
  getProjectRow,
  getProjectUsers,
} from "../db/instance/projects.ts";
import { getProjectMetrics } from "../db/project/metrics.ts";
import { getAllPresentationObjectsForProject } from "../db/project/presentation_objects.ts";
import { getAllVisualizationFolders } from "../db/project/visualization_folders.ts";
import { getAllSlideDecks } from "../db/project/slide_decks.ts";
import { getAllSlideDeckFolders } from "../db/project/slide_deck_folders.ts";

export async function buildProjectState(
  mainDb: Sql,
  projectDb: Sql,
  projectId: string,
  globalUser: GlobalUser,
): Promise<APIResponseWithData<ProjectState>> {
  try {
    const project = await getProjectRow(mainDb, projectId);
    if (!project) {
      return { success: false, err: "Project not found" };
    }

    const perms = await getProjectPermissions(
      mainDb,
      globalUser.email,
      projectId,
      globalUser.isAdmin,
    );

    const importHistory = (perms.can_view_data || perms.can_configure_data)
      ? await getImportHistory(mainDb, projectId)
      : [];

    const projectUsers = perms.can_configure_users
      ? await getProjectUsers(mainDb, projectId)
      : [];

    const [metricsRes, vizRes, vizFoldersRes, decksRes, deckFoldersRes] = await Promise.all([
      getProjectMetrics(projectDb),
      getAllPresentationObjectsForProject(projectDb),
      getAllVisualizationFolders(projectDb),
      getAllSlideDecks(projectDb),
      getAllSlideDeckFolders(projectDb),
    ]);

    if (!metricsRes.success) return metricsRes;
    if (!vizRes.success) return vizRes;
    if (!vizFoldersRes.success) return vizFoldersRes;
    if (!decksRes.success) return decksRes;
    if (!deckFoldersRes.success) return deckFoldersRes;

    const projectState: ProjectState = {
      isReady: true,
      currentUserEmail: globalUser.email,
      id: project.id,
      label: project.label,
      isLocked: project.is_locked,
      importHistory,
      projectUsers,
      thisUserPermissions: perms,
      metrics: metricsRes.data,
      visualizations: vizRes.data,
      visualizationFolders: vizFoldersRes.data,
      slideDecks: decksRes.data,
      slideDeckFolders: deckFoldersRes.data,
    };

    return { success: true, data: projectState };
  } catch (e) {
    console.error(e);
    return { success: false, err: e instanceof Error ? e.message : String(e) };
  }
}
