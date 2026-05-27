-- Modules imported from country servers
CREATE TABLE IF NOT EXISTS modules (
  id text PRIMARY KEY NOT NULL,
  module_definition text NOT NULL,
  config_selections text NOT NULL DEFAULT '{}',
  dirty text NOT NULL DEFAULT 'complete',
  compute_def_updated_at text,
  compute_def_git_ref text,
  presentation_def_updated_at text,
  presentation_def_git_ref text,
  config_updated_at text,
  last_run_at text NOT NULL DEFAULT '',
  last_run_git_ref text
);

-- Results object metadata (schema info)
CREATE TABLE IF NOT EXISTS results_objects (
  id text PRIMARY KEY NOT NULL,
  module_id text NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  column_definitions text
);

CREATE INDEX IF NOT EXISTS idx_results_objects_module_id ON results_objects(module_id);

-- Metrics extracted from module definitions
CREATE TABLE IF NOT EXISTS metrics (
  id text PRIMARY KEY NOT NULL,
  module_id text NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  label text NOT NULL,
  variant_label text,
  value_func text NOT NULL,
  format_as text NOT NULL,
  value_props text NOT NULL,
  required_disaggregation_options text NOT NULL,
  value_label_replacements text,
  post_aggregation_expression text,
  results_object_id text NOT NULL,
  ai_description text,
  viz_presets text,
  hide boolean NOT NULL DEFAULT FALSE,
  important_notes text
);

CREATE INDEX IF NOT EXISTS idx_metrics_module_id ON metrics(module_id);

-- Visualization folders
CREATE TABLE IF NOT EXISTS visualization_folders (
  id text PRIMARY KEY NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

-- Presentation objects (visualizations)
CREATE TABLE IF NOT EXISTS presentation_objects (
  id text PRIMARY KEY NOT NULL,
  metric_id text NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  label text NOT NULL,
  config text NOT NULL,
  last_updated text NOT NULL,
  folder_id text REFERENCES visualization_folders(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_presentation_objects_metric_id ON presentation_objects(metric_id);

-- Calculated indicator label map — imported from country servers
CREATE TABLE IF NOT EXISTS calculated_indicators_snapshot (
  calculated_indicator_id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  format_as TEXT NOT NULL DEFAULT 'number',
  decimal_places INTEGER NOT NULL DEFAULT 0,
  threshold_direction TEXT NOT NULL DEFAULT 'higher_is_better',
  threshold_green DOUBLE PRECISION NOT NULL DEFAULT 0,
  threshold_yellow DOUBLE PRECISION NOT NULL DEFAULT 0,
  group_label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
