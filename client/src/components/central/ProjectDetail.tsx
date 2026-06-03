import {
  Button,
  Checkbox,
  FrameLeft,
  FrameTop,
  ModalContainer,
  Select,
  StateHolderFormError,
  StateHolderWrapper,
  Table,
  TabsNavigation,
  type TableColumn,
  type AlertComponentProps,
  type SelectOption,
  openComponent,
  openConfirm,
  timActionButton,
  timActionForm,
  timQuery,
} from "panther";
import { _SERVER_HOST } from "~/server_actions";
import type { ImportProgressEvent } from "~/server_actions";
import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";
import type {
  CentralReportingProject,
  GlobalUser,
  ProjectDetail as ProjectDetailType,
  ProjectPermission,
  ProjectSummary,
  ProjectUser,
  ProjectUserPermissions,
} from "lib";
import {
  PERMISSION_PRESETS,
  PROJECT_PERMISSION_LABELS,
  PROJECT_PERMISSIONS,
  _PROJECT_USER_PERMISSIONS_NO_ACCESS,
} from "lib";
import { serverActions } from "~/server_actions";
import { clerk } from "~/components/LoggedInWrapper";
import { VisualizationsList } from "~/components/central/VisualizationsList";
import { VisualizationEditorEdit, VisualizationEditorCreate } from "~/components/central/VisualizationEditor";

type Props = {
  projectId: string;
  project: ProjectSummary | undefined;
  globalUser: GlobalUser;
  onProjectUpdated: () => Promise<void>;
  onBack: () => void;
};

export function ProjectDetail(p: Props) {
  const [editingPoId, setEditingPoId] = createSignal<string | null | undefined>(undefined);
  // undefined = list view, null = new PO, string = editing existing PO

  const [navCollapsed, setNavCollapsed] = createSignal(false);

  const detailQuery = timQuery(
    () => serverActions.getProject({ id: p.projectId }),
    "Loading...",
  );

  const perms = createMemo((): ProjectUserPermissions => {
    const s = detailQuery.state();
    if (s.status !== "ready") {
      return {
        can_configure_settings: false,
        can_configure_users: false,
        can_configure_data: false,
        can_view_data: false,
        can_configure_visualizations: false,
        can_view_visualizations: false,
      };
    }
    return s.data.thisUserPermissions;
  });

  type Tab = "data" | "visualizations" | "settings";
  const [currentTab, setCurrentTab] = createSignal<Tab>("data");

  const tabItems = [
    { id: "data" as const, label: "Data", iconName: "databaseImport" as const },
    { id: "visualizations" as const, label: "Visualizations", iconName: "chart" as const },
    { id: "settings" as const, label: "Settings", iconName: "settings" as const },
  ];

  function handleTabChange(tab: Tab) {
    setCurrentTab(tab);
    setEditingPoId(undefined);
  }

  const lockAction = timActionButton(
    async () => {
      const proj = p.project;
      if (!proj) return { success: false as const, err: "Project not found" };
      return serverActions.lockProject({
        id: p.projectId,
        lockAction: proj.isLocked ? "unlock" : "lock",
      });
    },
    async () => {
      await p.onProjectUpdated();
      detailQuery.silentFetch();
    },
  );

  const deleteAction = timActionButton(
    async () => {
      const confirmed = await openConfirm({ text: "Schedule this project for deletion?" });
      if (!confirmed) return { success: false as const, err: "Cancelled" };
      return serverActions.deleteProject({ id: p.projectId });
    },
    p.onProjectUpdated,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyColumns = createMemo((): TableColumn<any>[] => [
    { key: "sourceServerId", header: "Source server", sortable: true },
    {
      key: "importedAt",
      header: "Imported at",
      sortable: true,
      render: (row) => new Date(row.importedAt).toLocaleString(),
    },
    { key: "importedBy", header: "By", sortable: true },
    { key: "nResultsObjects", header: "Objects", sortable: true },
    { key: "nRowsTotal", header: "Rows", sortable: true },
    { key: "status", header: "Status", sortable: true },
  ]);

  return (
    <FrameTop
      panelChildren={
        <div class="ui-gap ui-pad bg-base-content border-base-content text-base-100 flex h-full w-full items-center border-b">
          <Button iconName="chevronLeft" onClick={p.onBack} />
          <div class="font-700 flex-1 truncate text-xl">
            <span class="font-400">{p.project?.label ?? ""}</span>
          </div>
        </div>
      }
    >
      <FrameLeft
        panelChildren={
          <div class="h-full border-r">
            <TabsNavigation
              items={tabItems}
              value={currentTab()}
              onChange={handleTabChange}
              vertical
              collapsible
              collapsed={navCollapsed()}
              onCollapsedChange={setNavCollapsed}
            />
          </div>
        }
      >
          <Switch>
            <Match when={currentTab() === "data"}>
              <div class="ui-pad flex flex-col gap-6 overflow-auto">
                <Show when={perms().can_configure_data}>
                  <_ImportPanel projectId={p.projectId} onImported={detailQuery.silentFetch} />
                </Show>
                <Show when={perms().can_view_data || perms().can_configure_data}>
                  <StateHolderWrapper state={detailQuery.state()}>
                    {(detail: ProjectDetailType) => (
                      <Show
                        when={detail.importHistory.length > 0}
                        fallback={
                          <div class="text-base-content/40 text-sm">No imports yet</div>
                        }
                      >
                        <div class="flex flex-col gap-2">
                          <div class="text-base-content/60 text-xs font-700 uppercase tracking-wider">
                            Import history
                          </div>
                          <Table
                            data={detail.importHistory as any[]}
                            columns={historyColumns()}
                            keyField="id"
                          />
                        </div>
                      </Show>
                    )}
                  </StateHolderWrapper>
                </Show>
              </div>
            </Match>

            <Match when={currentTab() === "visualizations"}>
              <Show
                when={perms().can_view_visualizations}
                fallback={
                  <div class="ui-pad text-base-content/40 text-sm">
                    {detailQuery.state().status === "loading" ? "Loading..." : "No access"}
                  </div>
                }
              >
                <Switch>
                  <Match when={typeof editingPoId() === "string"}>
                    <VisualizationEditorEdit
                      projectId={p.projectId}
                      poId={editingPoId() as string}
                      onClose={() => setEditingPoId(undefined)}
                      onSaved={() => setEditingPoId(undefined)}
                    />
                  </Match>
                  <Match when={editingPoId() === null}>
                    <VisualizationEditorCreate
                      projectId={p.projectId}
                      onClose={() => setEditingPoId(undefined)}
                      onSaved={(newId: string) => setEditingPoId(newId)}
                    />
                  </Match>
                  <Match when={true}>
                    <VisualizationsList
                      projectId={p.projectId}
                      canConfigure={perms().can_configure_visualizations}
                      onOpenEditor={(id) => setEditingPoId(id)}
                    />
                  </Match>
                </Switch>
              </Show>
            </Match>

            <Match when={currentTab() === "settings"}>
              <div class="ui-pad flex flex-col gap-6 overflow-auto">
                <Show when={perms().can_configure_users}>
                  <StateHolderWrapper state={detailQuery.state()}>
                    {(detail: ProjectDetailType) => (
                      <_ProjectUsersSection
                        projectId={p.projectId}
                        projectUsers={detail.projectUsers}
                        globalUser={p.globalUser}
                        onUpdated={detailQuery.silentFetch}
                      />
                    )}
                  </StateHolderWrapper>
                </Show>

                <Show when={perms().can_configure_settings}>
                  <div class="flex flex-col gap-3">
                    <div class="text-base-content/60 text-xs font-700 uppercase tracking-wider">
                      Project access
                    </div>
                    <div class="border-base-300 flex items-center justify-between rounded border p-4">
                      <div class="flex flex-col gap-1">
                        <div class="text-sm font-600">
                          {p.project?.isLocked ? "Project is locked" : "Project is unlocked"}
                        </div>
                        <div class="text-base-content/50 text-xs">
                          {p.project?.isLocked
                            ? "No further imports or edits until unlocked"
                            : "Imports and visualisation edits are allowed"}
                        </div>
                      </div>
                      <Button
                        intent={p.project?.isLocked ? "warning" : "primary"}
                        iconName={p.project?.isLocked ? "unlock" : "lock"}
                        state={lockAction.state()}
                        onClick={lockAction.click}
                        size="sm"
                      >
                        {p.project?.isLocked ? "Unlock" : "Lock"}
                      </Button>
                    </div>
                  </div>

                  <div class="flex flex-col gap-3">
                    <div class="text-danger/80 text-xs font-700 uppercase tracking-wider">
                      Danger zone
                    </div>
                    <div class="border-danger/30 flex items-center justify-between rounded border p-4">
                      <div class="flex flex-col gap-1">
                        <div class="text-sm font-600">Delete project</div>
                        <div class="text-base-content/50 text-xs">
                          Schedule this project and all its data for deletion
                        </div>
                      </div>
                      <Button
                        intent="danger"
                        iconName="trash"
                        state={deleteAction.state()}
                        onClick={deleteAction.click}
                        size="sm"
                        outline
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Show>
              </div>
            </Match>
          </Switch>
      </FrameLeft>
    </FrameTop>
  );
}

// ─── Project Users Section ────────────────────────────────────────────────────

type ProjectUsersSectionProps = {
  projectId: string;
  projectUsers: ProjectUser[];
  globalUser: GlobalUser;
  onUpdated: () => Promise<void>;
};

function _ProjectUsersSection(p: ProjectUsersSectionProps) {
  const [addEmail, setAddEmail] = createSignal("");

  const userColumns = createMemo((): TableColumn<ProjectUser>[] => [
    {
      key: "email",
      header: "User",
      sortable: true,
      render: (u) => (
        <div class="flex flex-col">
          <span class="text-sm">{u.email}</span>
          <Show when={u.firstName || u.lastName}>
            <span class="text-base-content/50 text-xs">
              {[u.firstName, u.lastName].filter(Boolean).join(" ")}
            </span>
          </Show>
        </div>
      ),
    },
    {
      key: "can_view_visualizations",
      header: "Role",
      sortable: false,
      render: (u) => {
        if (u.isAdmin) return <span class="text-primary text-sm">Admin (full access)</span>;
        const active = PROJECT_PERMISSIONS.filter((k) => u[k]);
        if (active.length === 0) return <span class="text-base-content/40 text-sm">No access</span>;
        return <span class="text-sm">{active.map((k) => PROJECT_PERMISSION_LABELS[k]).join(", ")}</span>;
      },
    },
    {
      key: "actions" as keyof ProjectUser,
      header: "",
      alignH: "right" as const,
      render: (u) => (
        <Show when={!u.isAdmin}>
          <div class="flex gap-1">
            <Button
              iconName="pencil"
              size="sm"
              intent="base-100"
              onClick={async (e: MouseEvent) => {
                e.stopPropagation();
                await openComponent<_EditPermissionsModalProps, undefined>({
                  element: _EditPermissionsModal,
                  props: { projectId: p.projectId, user: u, onSaved: p.onUpdated },
                });
              }}
            />
            <Button
              iconName="trash"
              size="sm"
              intent="danger"
              outline
              onClick={async (e: MouseEvent) => {
                e.stopPropagation();
                const confirmed = await openConfirm({ text: `Remove ${u.email} from this project?` });
                if (!confirmed) return;
                await serverActions.removeProjectUser({ projectId: p.projectId, email: u.email });
                await p.onUpdated();
              }}
            />
          </div>
        </Show>
      ),
    },
  ]);

  const addAction = timActionButton(
    async () => {
      const email = addEmail().trim().toLowerCase();
      if (!email) return { success: false as const, err: "Enter an email" };
      return serverActions.setProjectUserPermissions({
        projectId: p.projectId,
        email,
        permissions: _PROJECT_USER_PERMISSIONS_NO_ACCESS,
      });
    },
    async () => {
      setAddEmail("");
      await p.onUpdated();
    },
  );

  return (
    <div class="flex flex-col gap-3">
      <div class="text-base-content/60 text-xs font-700 uppercase tracking-wider">
        Project users
      </div>
      <Table
        data={p.projectUsers}
        columns={userColumns()}
        keyField="email"
        noRowsMessage="No users added yet"
      />
      <div class="flex items-end gap-2">
        <div class="flex flex-col gap-1">
          <label class="text-base-content/60 text-xs">Add user by email</label>
          <input
            type="email"
            class="border-base-300 rounded border px-3 py-1.5 text-sm"
            placeholder="user@example.com"
            value={addEmail()}
            onInput={(e) => setAddEmail(e.currentTarget.value)}
          />
        </div>
        <Button
          intent="primary"
          size="sm"
          state={addAction.state()}
          onClick={addAction.click}
          iconName="plus"
        >
          Add
        </Button>
      </div>
    </div>
  );
}

// ─── Edit Permissions Modal ───────────────────────────────────────────────────

type _EditPermissionsModalProps = {
  projectId: string;
  user: ProjectUser;
  onSaved: () => Promise<void>;
};

function _EditPermissionsModal(
  p: AlertComponentProps<_EditPermissionsModalProps, undefined>,
) {
  const [permissions, setPermissions] = createSignal<ProjectUserPermissions>({
    can_configure_settings: p.user.can_configure_settings,
    can_configure_users: p.user.can_configure_users,
    can_configure_data: p.user.can_configure_data,
    can_view_data: p.user.can_view_data,
    can_configure_visualizations: p.user.can_configure_visualizations,
    can_view_visualizations: p.user.can_view_visualizations,
  });

  const toggle = (key: ProjectPermission) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const save = timActionForm(
    () =>
      serverActions.setProjectUserPermissions({
        projectId: p.projectId,
        email: p.user.email,
        permissions: permissions(),
      }),
    async () => {
      await p.onSaved();
      p.close(undefined);
    },
  );

  return (
    <ModalContainer
      width="sm"
      topPanel={
        <div>
          <div class="font-700 text-lg">Edit permissions</div>
          <div class="text-base-content/60 text-sm">{p.user.email}</div>
        </div>
      }
      leftButtons={[
        <Button onClick={save.click} intent="success" state={save.state()} iconName="save">
          Save
        </Button>,
        <Button onClick={() => p.close(undefined)} intent="neutral" iconName="x">
          Cancel
        </Button>,
      ]}
    >
      <div class="flex flex-col gap-2">
        <div class="flex gap-2 flex-wrap">
          <For each={PERMISSION_PRESETS}>
            {(preset) => (
              <Button
                onClick={() => setPermissions({ ...preset.permissions })}
                intent="neutral"
                size="sm"
              >
                {preset.label}
              </Button>
            )}
          </For>
        </div>
        <div class="flex flex-col gap-2 pt-2">
          <For each={PROJECT_PERMISSIONS}>
            {(key) => (
              <Checkbox
                label={PROJECT_PERMISSION_LABELS[key]}
                checked={permissions()[key]}
                onChange={() => toggle(key)}
              />
            )}
          </For>
        </div>
      </div>
      <StateHolderFormError state={save.state()} />
    </ModalContainer>
  );
}

// ─── Import Panel ─────────────────────────────────────────────────────────────

type ImportPanelProps = {
  projectId: string;
  onImported: () => Promise<void>;
};

function _ImportPanel(p: ImportPanelProps) {
  const [selectedServerId, setSelectedServerId] = createSignal("");
  const [selectedProjectId, setSelectedProjectId] = createSignal("");

  const serversQuery = timQuery(
    () => serverActions.getServers({}),
    "Loading servers...",
  );

  const centralProjectsQuery = timQuery(
    async () => {
      const sId = selectedServerId();
      if (!sId) return { success: true as const, data: [] as CentralReportingProject[] };
      const token = (await clerk.session?.getToken()) ?? "";
      return serverActions.getCentralReportingProjects({ sourceServerId: sId, token });
    },
    "Loading projects...",
  );

  const [importPhase, setImportPhase] = createSignal<"idle" | "fetching" | "importing" | "inserting" | "done" | "error">("idle");
  const [importProgress, setImportProgress] = createSignal({ current: 0, total: 0 });
  const [importError, setImportError] = createSignal("");

  async function runImport() {
    const sId = selectedServerId();
    const pId = selectedProjectId();
    if (!sId || !pId) return;

    setImportPhase("fetching");
    setImportProgress({ current: 0, total: 0 });
    setImportError("");

    const token = (await clerk.session?.getToken()) ?? "";
    const initRes = await serverActions.importFromSourceInit({
      sourceServerId: sId,
      sourceProjectId: pId,
      targetProjectId: p.projectId,
      token,
    });
    if (!initRes.success) {
      setImportError(initRes.err);
      setImportPhase("error");
      return;
    }

    const { jobId } = initRes.data;
    const evtSource = new EventSource(`${_SERVER_HOST}/import_progress/${jobId}`, { withCredentials: true });

    evtSource.onmessage = async (evt) => {
      const event = JSON.parse(evt.data) as ImportProgressEvent;
      if (event.type === "fetching") {
        setImportPhase("fetching");
        setImportProgress({ current: event.index, total: event.total });
      } else if (event.type === "importing") {
        setImportPhase("importing");
      } else if (event.type === "inserting") {
        setImportPhase("inserting");
        setImportProgress({ current: event.index, total: event.total });
      } else if (event.type === "done") {
        evtSource.close();
        setSelectedProjectId("");
        try { await p.onImported(); } finally { setImportPhase("idle"); }
      } else if (event.type === "error") {
        evtSource.close();
        setImportError(event.err);
        setImportPhase("error");
      }
    };

    evtSource.onerror = () => {
      evtSource.close();
      if (importPhase() !== "idle") {
        setImportError("Connection closed unexpectedly");
        setImportPhase("error");
      }
    };
  }

  const serverOptions = createMemo((): SelectOption<string>[] => {
    const s = serversQuery.state();
    if (s.status !== "ready") return [];
    return s.data
      .filter((sv) => sv.mode !== "central")
      .map((sv) => ({ value: sv.id, label: sv.label }));
  });

  const projectOptions = createMemo((): SelectOption<string>[] => {
    const s = centralProjectsQuery.state();
    if (s.status !== "ready") return [];
    return s.data.map((pr) => ({ value: pr.id, label: pr.label }));
  });

  function onServerChange(id: string) {
    setSelectedServerId(id);
    setSelectedProjectId("");
    centralProjectsQuery.fetch();
  }

  return (
    <div class="flex flex-col gap-3">
      <div class="text-base-content/60 text-xs font-700 uppercase tracking-wider">
        Import from country server
      </div>
      <div class="flex items-end gap-2">
        <Select
          label="Country server"
          value={selectedServerId() || undefined}
          options={serverOptions()}
          onChange={onServerChange}
          placeholder="Select server..."
        />
        <Select
          label="Central reporting project"
          value={selectedProjectId() || undefined}
          options={projectOptions()}
          onChange={setSelectedProjectId}
          placeholder={selectedServerId() ? "Select project..." : "Select server first"}
        />
        <Show
          when={importPhase() === "idle" || importPhase() === "error"}
          fallback={
            <div class="flex flex-col gap-1 min-w-48">
              <div class="text-base-content/60 text-xs">
                <Switch>
                  <Match when={importPhase() === "fetching"}>
                    Fetching data… ({importProgress().current}/{importProgress().total})
                  </Match>
                  <Match when={importPhase() === "importing"}>
                    Saving…
                  </Match>
                  <Match when={importPhase() === "inserting"}>
                    Saving… ({importProgress().current}/{importProgress().total})
                  </Match>
                  <Match when={importPhase() === "done"}>
                    Done
                  </Match>
                </Switch>
              </div>
              <div class="h-1.5 w-full rounded-full bg-base-300 overflow-hidden">
                <div
                  class="h-full bg-primary transition-all duration-300"
                  style={{
                    width: importPhase() === "importing" || importPhase() === "done"
                      ? "100%"
                      : `${importProgress().total ? (importProgress().current / importProgress().total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          }
        >
          <div class="flex flex-col gap-1">
            <Show when={importPhase() === "error"}>
              <div class="text-error text-xs">{importError()}</div>
            </Show>
            <Button
              intent="primary"
              onClick={runImport}
              size="sm"
              disabled={!selectedServerId() || !selectedProjectId()}
            >
              Import
            </Button>
          </div>
        </Show>
      </div>
    </div>
  );
}
