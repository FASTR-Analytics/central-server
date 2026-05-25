export type DBProject = {
  id: string;
  label: string;
  is_locked: boolean;
  status: string;
  created_at: Date;
  deletion_scheduled_at: Date | null;
};

export type DBImportHistory = {
  id: number;
  source_server_id: string;
  source_server_label: string;
  source_project_id: string;
  target_project_id: string;
  imported_at: Date;
  imported_by: string;
  n_results_objects: number;
  n_rows_total: number;
  status: string;
};
