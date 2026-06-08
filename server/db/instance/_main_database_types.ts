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

export type DBUser = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean;
  can_configure_users: boolean;
  can_create_projects: boolean;
};

export type DBProjectUserRole = {
  email: string;
  project_id: string;
  can_configure_settings: boolean;
  can_configure_users: boolean;
  can_configure_data: boolean;
  can_view_data: boolean;
  can_configure_visualizations: boolean;
  can_view_visualizations: boolean;
  can_view_slide_decks: boolean;
  can_configure_slide_decks: boolean;
};
