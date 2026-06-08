export type DBModule = {
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

export type DBResultsObject = {
  id: string;
  module_id: string;
  column_definitions: string | null;
};

export type DBMetric = {
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

export type DBPresentationObject = {
  id: string;
  metric_id: string;
  label: string;
  config: string;
  last_updated: string;
  folder_id: string | null;
  sort_order: number;
};

export type DBVisualizationFolder = {
  id: string;
  label: string;
  sort_order: number;
};

export type DBSlideDeck = {
  id: string;
  label: string;
  plan: string | null;
  config: string | null;
  folder_id: string | null;
  last_updated: string;
};

export type DBSlide = {
  id: string;
  slide_deck_id: string;
  sort_order: number;
  config: string;
  last_updated: string;
};

export type DBSlideDeckFolder = {
  id: string;
  label: string;
  color: string | null;
  sort_order: number;
};

export type DBCalculatedIndicatorSnapshot = {
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
