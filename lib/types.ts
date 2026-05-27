// Core shared types for central-server

export type ProjectUserPermissions = {
  can_configure_settings: boolean;
  can_configure_users: boolean;
  can_configure_data: boolean;
  can_view_data: boolean;
  can_configure_visualizations: boolean;
  can_view_visualizations: boolean;
};

export type ProjectPermission = keyof ProjectUserPermissions;

export const PROJECT_PERMISSIONS: readonly ProjectPermission[] = [
  "can_configure_settings",
  "can_configure_users",
  "can_configure_data",
  "can_view_data",
  "can_configure_visualizations",
  "can_view_visualizations",
] as const;

export const PROJECT_PERMISSION_LABELS: Record<ProjectPermission, string> = {
  can_configure_settings: "Configure settings",
  can_configure_users: "Manage project users",
  can_configure_data: "Import data",
  can_view_data: "View import history",
  can_configure_visualizations: "Create and edit visualizations",
  can_view_visualizations: "View visualizations",
};

export const PERMISSION_PRESETS: { label: string; permissions: ProjectUserPermissions }[] = [
  {
    label: "No access",
    permissions: {
      can_configure_settings: false,
      can_configure_users: false,
      can_configure_data: false,
      can_view_data: false,
      can_configure_visualizations: false,
      can_view_visualizations: false,
    },
  },
  {
    label: "Viewer",
    permissions: {
      can_configure_settings: false,
      can_configure_users: false,
      can_configure_data: false,
      can_view_data: true,
      can_configure_visualizations: false,
      can_view_visualizations: true,
    },
  },
  {
    label: "Editor",
    permissions: {
      can_configure_settings: false,
      can_configure_users: false,
      can_configure_data: true,
      can_view_data: true,
      can_configure_visualizations: true,
      can_view_visualizations: true,
    },
  },
  {
    label: "Admin",
    permissions: {
      can_configure_settings: true,
      can_configure_users: true,
      can_configure_data: true,
      can_view_data: true,
      can_configure_visualizations: true,
      can_view_visualizations: true,
    },
  },
];

export const _PROJECT_USER_PERMISSIONS_NO_ACCESS: ProjectUserPermissions = {
  can_configure_settings: false,
  can_configure_users: false,
  can_configure_data: false,
  can_view_data: false,
  can_configure_visualizations: false,
  can_view_visualizations: false,
};

export const _PROJECT_USER_PERMISSIONS_FULL_ACCESS: ProjectUserPermissions = {
  can_configure_settings: true,
  can_configure_users: true,
  can_configure_data: true,
  can_view_data: true,
  can_configure_visualizations: true,
  can_view_visualizations: true,
};

export type GlobalUser = {
  email: string;
  isHUser: boolean;
  isAdmin: boolean;   // isHUser OR db is_admin
  approved: boolean;  // false if not in users table (and not h_user)
  firstName?: string;
  lastName?: string;
  canConfigureUsers: boolean;
  canCreateProjects: boolean;
};

export type InstanceUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin: boolean;
  canConfigureUsers: boolean;
  canCreateProjects: boolean;
};

export type ProjectUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin: boolean;
} & ProjectUserPermissions;

export type ProjectSummary = {
  id: string;
  label: string;
  isLocked: boolean;
  status: "ready" | "pending_deletion";
  createdAt: string;
};

export type ProjectDetail = {
  id: string;
  label: string;
  isLocked: boolean;
  status: "ready" | "pending_deletion";
  createdAt: string;
  importHistory: ImportHistoryEntry[];
  thisUserPermissions: ProjectUserPermissions;
  projectUsers: ProjectUser[];
};

export type ImportHistoryEntry = {
  id: number;
  sourceServerId: string;
  sourceServerLabel: string;
  sourceProjectId: string;
  importedAt: string;
  importedBy: string;
  nResultsObjects: number;
  nRowsTotal: number;
  status: "success" | "partial" | "failed";
};

export type CentralReportingProject = {
  id: string;
  label: string;
  modules: Array<{
    id: string;
    lastRunAt: string | null;
    lastRunGitRef: string | null;
    dirty: string;
  }>;
};

// Shape of the export payload from a country server
export type CentralExportPayload = {
  exportedAt: string;
  sourceInstanceId: string;
  sourceInstanceLabel: string;
  sourceProjectId: string;
  modules: CountryModule[];
  resultsObjects: CountryResultsObject[];
  metrics: CountryMetric[];
  calculatedIndicators: CountryCalculatedIndicator[];
};

export type CountryCalculatedIndicator = {
  calculated_indicator_id: string;
  label: string;
  format_as: string;
  decimal_places: number;
  threshold_direction: string;
  threshold_green: number;
  threshold_yellow: number;
  group_label: string;
  sort_order: number;
};

export type CountryModule = {
  id: string;
  module_definition: string;
  config_selections: string;
  dirty: string;
  compute_def_updated_at: string | null;
  compute_def_git_ref: string | null;
  presentation_def_updated_at: string | null;
  presentation_def_git_ref: string | null;
  config_updated_at: string | null;
  last_run_at: string;
  last_run_git_ref: string | null;
};

export type CountryResultsObject = {
  id: string;
  moduleId: string;
  columnDefinitions: string | null;
  rows: Record<string, unknown>[];
};

export type CountryMetric = {
  id: string;
  module_id: string;
  label: string;
  variant_label: string | null;
  value_func: string;
  format_as: string;
  value_props: string;
  required_disaggregation_options: string;
  value_label_replacements: string | null;
  post_aggregation_expression: string | null;
  results_object_id: string;
  ai_description: string | null;
  viz_presets: string | null;
  hide: boolean;
  important_notes: string | null;
};
