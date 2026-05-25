// Core shared types for central-server

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

export type GlobalUser = {
  email: string;
  isHUser: boolean;
  approved: boolean;
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
  columnDefinitions: string | null; // JSON: Record<string, string>
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
