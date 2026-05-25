CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY NOT NULL,
  label text NOT NULL,
  is_locked boolean NOT NULL DEFAULT FALSE,
  status text NOT NULL DEFAULT 'ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deletion_scheduled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS import_history (
  id SERIAL PRIMARY KEY,
  source_server_id text NOT NULL,
  source_server_label text NOT NULL DEFAULT '',
  source_project_id text NOT NULL,
  target_project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by text NOT NULL,
  n_results_objects integer NOT NULL DEFAULT 0,
  n_rows_total integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('success', 'partial', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_import_history_target_project ON import_history(target_project_id);
