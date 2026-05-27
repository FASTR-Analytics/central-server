import type { APIResponseWithData, APIResponseNoData } from "panther";
import type { GlobalUser, ProjectSummary, ProjectDetail, CentralReportingProject, InstanceUser, ProjectUser, ProjectUserPermissions } from "lib";

export type { InstanceUser, ProjectUser, ProjectUserPermissions };
import type {
  GenericLongFormFetchConfig,
  ItemsHolderPresentationObject,
  ResultsValueInfoForPresentationObject,
  PeriodOption,
} from "platform-lib";

export type ServerEntry = { id: string; label: string; mode?: "central" };

export type ProjectMetric = {
  id: string;
  moduleId: string;
  label: string;
  variantLabel: string | null;
  valueFunc: string;
  formatAs: string;
  valueProps: string;
  requiredDisaggregationOptions: string;
  resultsObjectId: string;
  hide: boolean;
  lastRunAt: string;
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

  getServers: (_args: Record<string, never>) =>
    fetch(`${_SERVER_HOST}/servers.json`)
      .then(r => r.json())
      .then((data: ServerEntry[]) => ({ success: true as const, data }))
      .catch((err: unknown) => ({ success: false as const, err: String(err) })),

  getCentralReportingProjects: (args: { sourceServerId: string; token: string }) =>
    apiFetch<CentralReportingProject[]>(`/central_reporting_projects/${args.sourceServerId}`, {
      token: args.token,
    }),

  importFromSource: (args: { sourceServerId: string; sourceProjectId: string; targetProjectId: string; token: string }) =>
    apiFetch<{ nResultsObjects: number; nRowsTotal: number }>("/import_from_source", {
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

  duplicatePresentationObject: (args: { projectId: string; id: string; label: string }) =>
    apiFetch<{ id: string }>(`/projects/${args.projectId}/presentation_objects/${args.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: args.label }),
    }),

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
};
