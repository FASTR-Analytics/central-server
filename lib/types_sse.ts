import type {
  SlideDeckFolder,
  SlideDeckSummary,
  VisualizationFolder,
} from "platform-lib";
import type {
  ImportHistoryEntry,
  PresentationObjectSummary,
  ProjectMetric,
  ProjectUser,
  ProjectUserPermissions,
} from "./types.ts";

// ─── Project SSE ──────────────────────────────────────────────────────────────

export type ProjectState = {
  isReady: boolean;
  currentUserEmail: string;
  id: string;
  label: string;
  isLocked: boolean;
  importHistory: ImportHistoryEntry[];
  projectUsers: ProjectUser[];
  thisUserPermissions: ProjectUserPermissions;
  metrics: ProjectMetric[];
  visualizations: PresentationObjectSummary[];
  visualizationFolders: VisualizationFolder[];
  slideDecks: SlideDeckSummary[];
  slideDeckFolders: SlideDeckFolder[];
};

export type ProjectSseMessage =
  | { type: "starting"; data: ProjectState }
  | { type: "project_config_updated"; data: { label: string; isLocked: boolean } }
  | { type: "metrics_updated"; data: { metrics: ProjectMetric[] } }
  | { type: "visualizations_updated"; data: { visualizations: PresentationObjectSummary[] } }
  | { type: "visualization_folders_updated"; data: { visualizationFolders: VisualizationFolder[] } }
  | { type: "slide_decks_updated"; data: { slideDecks: SlideDeckSummary[] } }
  | { type: "slide_deck_folders_updated"; data: { slideDeckFolders: SlideDeckFolder[] } }
  | { type: "project_users_updated"; data: { projectUsers: ProjectUser[] } }
  | { type: "import_history_updated"; data: { importHistory: ImportHistoryEntry[] } }
  | { type: "error"; data: { message: string } };

// ─── Instance SSE ─────────────────────────────────────────────────────────────

export type InstanceState = {
  isReady: boolean;
  currentUserEmail: string;
  projectsLastUpdated: string;
  usersLastUpdated: string;
};

export type InstanceSseMessage =
  | { type: "starting"; data: InstanceState }
  | { type: "projects_last_updated"; data: string }
  | { type: "users_last_updated"; data: string }
  | { type: "error"; data: { message: string } };
