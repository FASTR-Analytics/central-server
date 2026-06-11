import type {
  ImportHistoryEntry,
  PresentationObjectSummary,
  ProjectMetric,
  ProjectSseMessage,
  ProjectUser,
} from "lib";
import type {
  SlideDeckFolder,
  SlideDeckSummary,
  VisualizationFolder,
} from "platform-lib";

export const PROJECT_UPDATES_CHANNEL = "project_updates_v2";

const broadcastV2 = new BroadcastChannel(PROJECT_UPDATES_CHANNEL);

type ProjectSseMessageWithProjectId = ProjectSseMessage & { projectId: string };

export function notifyProjectV2(
  projectId: string,
  message: ProjectSseMessage,
): void {
  const msg: ProjectSseMessageWithProjectId = { ...message, projectId };
  broadcastV2.postMessage(msg);
}

export function notifyProjectConfigUpdated(
  projectId: string,
  label: string,
  isLocked: boolean,
): void {
  notifyProjectV2(projectId, {
    type: "project_config_updated",
    data: { label, isLocked },
  });
}

export function notifyProjectMetricsUpdated(
  projectId: string,
  metrics: ProjectMetric[],
): void {
  notifyProjectV2(projectId, {
    type: "metrics_updated",
    data: { metrics },
  });
}

export function notifyProjectVisualizationsUpdated(
  projectId: string,
  visualizations: PresentationObjectSummary[],
): void {
  notifyProjectV2(projectId, {
    type: "visualizations_updated",
    data: { visualizations },
  });
}

export function notifyProjectVisualizationFoldersUpdated(
  projectId: string,
  visualizationFolders: VisualizationFolder[],
): void {
  notifyProjectV2(projectId, {
    type: "visualization_folders_updated",
    data: { visualizationFolders },
  });
}

export function notifyProjectSlideDecksUpdated(
  projectId: string,
  slideDecks: SlideDeckSummary[],
): void {
  notifyProjectV2(projectId, {
    type: "slide_decks_updated",
    data: { slideDecks },
  });
}

export function notifyProjectSlideDeckFoldersUpdated(
  projectId: string,
  slideDeckFolders: SlideDeckFolder[],
): void {
  notifyProjectV2(projectId, {
    type: "slide_deck_folders_updated",
    data: { slideDeckFolders },
  });
}

export function notifyProjectUsersUpdated(
  projectId: string,
  projectUsers: ProjectUser[],
): void {
  notifyProjectV2(projectId, {
    type: "project_users_updated",
    data: { projectUsers },
  });
}

export function notifyProjectImportHistoryUpdated(
  projectId: string,
  importHistory: ImportHistoryEntry[],
): void {
  notifyProjectV2(projectId, {
    type: "import_history_updated",
    data: { importHistory },
  });
}
