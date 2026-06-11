import type { APIResponseWithData, APIResponseNoData } from "panther";
import type { GlobalUser, ProjectSummary, ProjectDetail, CentralReportingProject, InstanceUser, ProjectUser, ProjectUserPermissions } from "lib";
import type { Slide, SlideDeckConfig, SlidePosition, SlideDeckSummary, SlideDeckDetail, SlideDeckFolder, SlideWithMeta, VisualizationFolder } from "platform-lib";
export type { Slide, SlideDeckConfig, SlidePosition, SlideDeckSummary, SlideDeckDetail, SlideDeckFolder, SlideWithMeta, VisualizationFolder };

export type { InstanceUser, ProjectUser, ProjectUserPermissions };
import type {
  DisaggregationOption,
  GenericLongFormFetchConfig,
  ItemsHolderPresentationObject,
  ResultsValueInfoForPresentationObject,
  PeriodOption,
} from "platform-lib";

export type ServerEntry = { id: string; label: string; mode?: "central" };

export type ImportProgressEvent =
  | { type: "fetching"; roId: string; index: number; total: number; rowsFetched: number }
  | { type: "importing" }
  | { type: "inserting"; index: number; total: number }
  | { type: "done"; nResultsObjects: number; nRowsTotal: number }
  | { type: "error"; err: string };

export type ProjectMetric = {
  id: string;
  moduleId: string;
  label: string;
  variantLabel: string | null;
  valueFunc: string;
  formatAs: string;
  valueProps: string;
  requiredDisaggregationOptions: string;
  availableDisaggregationOptions: string;
  valueLabelReplacements: string | null;
  postAggregationExpression: string | null;
  resultsObjectId: string;
  hide: boolean;
  lastRunAt: string;
  vizPresets: string | null;
};

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

export const _SERVER_HOST =
  process.env.NODE_ENV === "production" ? "" : "http://localhost:8000";

async function apiFetch<T>(
  url: string,
  init?: RequestInit & { token?: string },
): Promise<APIResponseWithData<T>> {
  const { token, ...fetchInit } = init ?? {};
  try {
    const res = await fetch(`${_SERVER_HOST}${url}`, {
      ...fetchInit,
      credentials: "include",
      headers: {
        ...fetchInit.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    return data as APIResponseWithData<T>;
  } catch (err) {
    return { success: false, err: err instanceof Error ? err.message : String(err) };
  }
}

async function apiNoData(
  url: string,
  init?: RequestInit,
): Promise<APIResponseNoData> {
  try {
    const res = await fetch(`${_SERVER_HOST}${url}`, {
      ...init,
      credentials: "include",
    });
    const data = await res.json();
    return data as APIResponseNoData;
  } catch (err) {
    return { success: false, err: err instanceof Error ? err.message : String(err) };
  }
}

export const serverActions = {
  getGlobalUser: (_args: Record<string, never>) =>
    apiFetch<GlobalUser>("/me"),

  getProjects: (_args: Record<string, never>) =>
    apiFetch<ProjectSummary[]>("/projects"),

  getProject: (args: { id: string }) =>
    apiFetch<ProjectDetail>(`/projects/${args.id}`),

  createProject: (args: { label: string }) =>
    apiFetch<{ id: string }>("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: args.label }),
    }),

  updateProject: (args: { id: string; label: string }) =>
    apiNoData(`/projects/${args.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: args.label }),
    }),

  lockProject: (args: { id: string; lockAction: "lock" | "unlock" }) =>
    apiFetch<{ isLocked: boolean }>(`/projects/${args.id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lockAction: args.lockAction }),
    }),

  deleteProject: (args: { id: string }) =>
    apiNoData(`/projects/${args.id}`, { method: "DELETE" }),

  deleteCountryImportData: (args: { projectId: string; sourceServerId: string }) =>
    apiNoData(`/projects/${args.projectId}/data/${encodeURIComponent(args.sourceServerId)}`, { method: "DELETE" }),

  getServers: (_args: Record<string, never>) =>
    fetch(`${_SERVER_HOST}/servers.json`)
      .then(r => r.json())
      .then((data: ServerEntry[]) => ({ success: true as const, data }))
      .catch((err: unknown) => ({ success: false as const, err: String(err) })),

  getCentralReportingProjects: (args: { sourceServerId: string; token: string }) =>
    apiFetch<CentralReportingProject[]>(`/central_reporting_projects/${args.sourceServerId}`, {
      token: args.token,
    }),

  importFromSourceInit: (args: { sourceServerId: string; sourceProjectId: string; targetProjectId: string; token: string }) =>
    apiFetch<{ jobId: string }>("/import_from_source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceServerId: args.sourceServerId,
        sourceProjectId: args.sourceProjectId,
        targetProjectId: args.targetProjectId,
      }),
      token: args.token,
    }),

  // Metrics for a project
  getProjectMetrics: (args: { projectId: string }) =>
    apiFetch<ProjectMetric[]>(`/projects/${args.projectId}/metrics`),

  // Presentation objects
  listPresentationObjects: (args: { projectId: string }) =>
    apiFetch<PresentationObjectSummary[]>(`/projects/${args.projectId}/presentation_objects`),

  getPresentationObject: (args: { projectId: string; id: string }) =>
    apiFetch<PresentationObjectDetail>(`/projects/${args.projectId}/presentation_objects/${args.id}`),

  createPresentationObject: (args: { projectId: string; metricId: string; label: string; config: unknown }) =>
    apiFetch<{ id: string }>(`/projects/${args.projectId}/presentation_objects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metricId: args.metricId, label: args.label, config: args.config }),
    }),

  updatePresentationObjectLabel: (args: { projectId: string; id: string; label: string }) =>
    apiNoData(`/projects/${args.projectId}/presentation_objects/${args.id}/label`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: args.label }),
    }),

  updatePresentationObjectConfig: (args: { projectId: string; id: string; config: unknown }) =>
    apiNoData(`/projects/${args.projectId}/presentation_objects/${args.id}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: args.config }),
    }),

  deletePresentationObject: (args: { projectId: string; id: string }) =>
    apiNoData(`/projects/${args.projectId}/presentation_objects/${args.id}`, { method: "DELETE" }),

  duplicatePresentationObject: (args: { projectId: string; id: string; label: string; folderId?: string | null }) =>
    apiFetch<{ id: string }>(`/projects/${args.projectId}/presentation_objects/${args.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: args.label, folderId: args.folderId }),
    }),

  updatePresentationObjectFolder: (args: { projectId: string; id: string; folderId: string | null }) =>
    apiFetch<{ lastUpdated: string }>(`/projects/${args.projectId}/presentation_objects/${args.id}/folder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: args.folderId }),
    }),

  // Visualization Folders
  listVisualizationFolders: (args: { projectId: string }) =>
    apiFetch<VisualizationFolder[]>(`/projects/${args.projectId}/visualization_folders`),

  createVisualizationFolder: (args: { projectId: string; label: string; color?: string; description?: string }) =>
    apiFetch<{ folderId: string; lastUpdated: string }>(`/projects/${args.projectId}/visualization_folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: args.label, color: args.color, description: args.description }),
    }),

  updateVisualizationFolder: (args: { projectId: string; folderId: string; label: string; color?: string | null; description?: string | null }) =>
    apiFetch<{ lastUpdated: string }>(`/projects/${args.projectId}/visualization_folders/${args.folderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: args.label, color: args.color, description: args.description }),
    }),

  deleteVisualizationFolder: (args: { projectId: string; folderId: string }) =>
    apiFetch<{ lastUpdated: string }>(`/projects/${args.projectId}/visualization_folders/${args.folderId}`, { method: "DELETE" }),

  getPresentationObjectItems: (args: {
    projectId: string;
    resultsObjectId: string;
    fetchConfig: GenericLongFormFetchConfig;
    firstPeriodOption?: PeriodOption;
    moduleLastRun: string;
  }) =>
    apiFetch<ItemsHolderPresentationObject>(`/projects/${args.projectId}/presentation_object_items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resultsObjectId: args.resultsObjectId,
        fetchConfig: args.fetchConfig,
        firstPeriodOption: args.firstPeriodOption,
        moduleLastRun: args.moduleLastRun,
      }),
    }),

  getReplicantOptions: (args: {
    projectId: string;
    resultsObjectId: string;
    replicantDisOpt: DisaggregationOption;
    fetchConfig: GenericLongFormFetchConfig;
  }) =>
    apiFetch<{ id: string; label: string }[]>(`/projects/${args.projectId}/replicant_options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resultsObjectId: args.resultsObjectId,
        replicantDisOpt: args.replicantDisOpt,
        fetchConfig: args.fetchConfig,
      }),
    }),

  getResultsValueInfo: (args: { projectId: string; metricId: string; moduleLastRun: string }) =>
    apiFetch<ResultsValueInfoForPresentationObject>(`/projects/${args.projectId}/results_value_info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metricId: args.metricId, moduleLastRun: args.moduleLastRun }),
    }),

  // Instance user management
  getUsers: (_args: Record<string, never>) =>
    apiFetch<InstanceUser[]>("/users"),

  addUsers: (args: { emails: string[] }) =>
    apiFetch<Record<string, never>>("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: args.emails }),
    }),

  deleteUser: (args: { email: string }) =>
    apiFetch<Record<string, never>>(`/users/${encodeURIComponent(args.email)}`, {
      method: "DELETE",
    }),

  toggleUserAdmin: (args: { email: string; isAdmin: boolean }) =>
    apiFetch<Record<string, never>>(`/users/${encodeURIComponent(args.email)}/admin`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: args.isAdmin }),
    }),

  // Project user management
  setProjectUserPermissions: (args: {
    projectId: string;
    email: string;
    permissions: ProjectUserPermissions;
  }) =>
    apiFetch<Record<string, never>>(
      `/projects/${args.projectId}/users/${encodeURIComponent(args.email)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.permissions),
      },
    ),

  removeProjectUser: (args: { projectId: string; email: string }) =>
    apiFetch<Record<string, never>>(
      `/projects/${args.projectId}/users/${encodeURIComponent(args.email)}`,
      { method: "DELETE" },
    ),

  getProjectUserPermissions: (args: { projectId: string; email: string }) =>
    apiFetch<ProjectUserPermissions>(
      `/projects/${args.projectId}/users/${encodeURIComponent(args.email)}`,
    ),

  updateUserInstancePermissions: (args: { email: string; canConfigureUsers: boolean; canCreateProjects: boolean }) =>
    apiFetch<Record<string, never>>(`/users/${encodeURIComponent(args.email)}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canConfigureUsers: args.canConfigureUsers, canCreateProjects: args.canCreateProjects }),
    }),

  // Slide Decks
  listSlideDecks: (args: { projectId: string }) =>
    apiFetch<SlideDeckSummary[]>(`/projects/${args.projectId}/slide_decks`),

  getSlideDeckDetail: (args: { projectId: string; deckId: string }) =>
    apiFetch<SlideDeckDetail>(`/projects/${args.projectId}/slide_decks/${args.deckId}`),

  createSlideDeck: (args: { projectId: string; label: string; folderId?: string | null }) =>
    apiFetch<{ deckId: string; lastUpdated: string }>(`/projects/${args.projectId}/slide_decks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: args.label, folderId: args.folderId }),
    }),

  updateSlideDeckLabel: (args: { projectId: string; deckId: string; label: string }) =>
    apiFetch<{ lastUpdated: string }>(`/projects/${args.projectId}/slide_decks/${args.deckId}/label`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: args.label }),
    }),

  updateSlideDeckPlan: (args: { projectId: string; deckId: string; plan: string }) =>
    apiFetch<{ lastUpdated: string }>(`/projects/${args.projectId}/slide_decks/${args.deckId}/plan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: args.plan }),
    }),

  updateSlideDeckConfig: (args: { projectId: string; deckId: string; config: SlideDeckConfig }) =>
    apiFetch<{ lastUpdated: string }>(`/projects/${args.projectId}/slide_decks/${args.deckId}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: args.config }),
    }),

  moveSlideDeckToFolder: (args: { projectId: string; deckId: string; folderId: string | null }) =>
    apiFetch<{ lastUpdated: string }>(`/projects/${args.projectId}/slide_decks/${args.deckId}/folder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: args.folderId }),
    }),

  duplicateSlideDeck: (args: { projectId: string; deckId: string; label: string; folderId?: string | null }) =>
    apiFetch<{ newDeckId: string; lastUpdated: string }>(`/projects/${args.projectId}/slide_decks/${args.deckId}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: args.label, folderId: args.folderId }),
    }),

  deleteSlideDeck: (args: { projectId: string; deckId: string }) =>
    apiNoData(`/projects/${args.projectId}/slide_decks/${args.deckId}`, { method: "DELETE" }),

  // Slides
  getSlides: (args: { projectId: string; deckId: string }) =>
    apiFetch<SlideWithMeta[]>(`/projects/${args.projectId}/slide_decks/${args.deckId}/slides`),

  getSlide: (args: { projectId: string; slideId: string }) =>
    apiFetch<SlideWithMeta>(`/projects/${args.projectId}/slides/${args.slideId}`),

  createSlide: (args: { projectId: string; deckId: string; slide: Slide; position: SlidePosition }) =>
    apiFetch<{ slideId: string; lastUpdated: string }>(`/projects/${args.projectId}/slide_decks/${args.deckId}/slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slide: args.slide, position: args.position }),
    }),

  updateSlide: (args: { projectId: string; slideId: string; slide: Slide }) =>
    apiFetch<{ lastUpdated: string }>(`/projects/${args.projectId}/slides/${args.slideId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slide: args.slide }),
    }),

  deleteSlides: (args: { projectId: string; deckId: string; slideIds: string[] }) =>
    apiFetch<{ deletedCount: number }>(`/projects/${args.projectId}/slide_decks/${args.deckId}/slides`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slideIds: args.slideIds }),
    }),

  duplicateSlides: (args: { projectId: string; deckId: string; slideIds: string[] }) =>
    apiFetch<{ newSlideIds: string[]; lastUpdated: string }>(`/projects/${args.projectId}/slide_decks/${args.deckId}/slides/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slideIds: args.slideIds }),
    }),

  moveSlides: (args: { projectId: string; deckId: string; slideIds: string[]; position: SlidePosition }) =>
    apiFetch<{ lastUpdated: string }>(`/projects/${args.projectId}/slide_decks/${args.deckId}/slides/move`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slideIds: args.slideIds, position: args.position }),
    }),

  // Slide Deck Folders
  listSlideDeckFolders: (args: { projectId: string }) =>
    apiFetch<SlideDeckFolder[]>(`/projects/${args.projectId}/slide_deck_folders`),

  createSlideDeckFolder: (args: { projectId: string; label: string; color?: string; description?: string }) =>
    apiFetch<{ folderId: string; lastUpdated: string }>(`/projects/${args.projectId}/slide_deck_folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: args.label, color: args.color, description: args.description }),
    }),

  updateSlideDeckFolder: (args: { projectId: string; folderId: string; label: string; color?: string | null; description?: string | null }) =>
    apiFetch<{ lastUpdated: string }>(`/projects/${args.projectId}/slide_deck_folders/${args.folderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: args.label, color: args.color, description: args.description }),
    }),

  deleteSlideDeckFolder: (args: { projectId: string; folderId: string }) =>
    apiFetch<{ lastUpdated: string }>(`/projects/${args.projectId}/slide_deck_folders/${args.folderId}`, { method: "DELETE" }),
};
