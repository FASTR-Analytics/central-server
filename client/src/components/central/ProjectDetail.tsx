import {
  Button,
  HeadingBar,
  Select,
  type SelectOption,
  StateHolderWrapper,
  Table,
  type TableColumn,
  openConfirm,
  timActionButton,
  timQuery,
} from "panther";
import { Show, createMemo, createSignal, Switch, Match } from "solid-js";
import type { CentralReportingProject, ProjectSummary, ProjectDetail as ProjectDetailType } from "lib";
import { serverActions } from "~/server_actions";
import { clerk } from "~/components/LoggedInWrapper";
import { VisualizationsList } from "~/components/central/VisualizationsList";
import { VisualizationEditor } from "~/components/central/VisualizationEditor";

type Props = {
  projectId: string;
  project: ProjectSummary | undefined;
  onProjectUpdated: () => Promise<void>;
  isHUser: boolean;
};

type Tab = "overview" | "visualizations";

export function ProjectDetail(p: Props) {
  const [activeTab, setActiveTab] = createSignal<Tab>("overview");
  const [editingPoId, setEditingPoId] = createSignal<string | null | undefined>(undefined);
  // undefined = list view, null = new PO, string = editing existing PO

  const detailQuery = timQuery(
    () => serverActions.getProject({ id: p.projectId }),
    "Loading...",
  );

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
    <div class="ui-spy flex h-full flex-col">
      <HeadingBar
        heading={p.project?.label ?? ""}
        ensureHeightAsIfButton
      >
        <Show when={p.isHUser}>
          <div class="flex items-center gap-2">
            <Button
              intent={p.project?.isLocked ? "warning" : "primary"}
              iconName={p.project?.isLocked ? "unlock" : "lock"}
              state={lockAction.state()}
              onClick={lockAction.click}
              size="sm"
            >
              {p.project?.isLocked ? "Unlock" : "Lock"}
            </Button>
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
        </Show>
      </HeadingBar>

      {/* Tab bar */}
      <div class="flex border-b border-base-300 px-4">
        {(["overview", "visualizations"] as Tab[]).map((tab) => (
          <button
            class={`px-4 py-2 text-sm font-600 border-b-2 transition-colors ${activeTab() === tab ? "border-primary text-primary" : "border-transparent text-base-content/50 hover:text-base-content"}`}
            onClick={() => { setActiveTab(tab); setEditingPoId(undefined); }}
          >
            {tab === "overview" ? "Overview" : "Visualizations"}
          </button>
        ))}
      </div>

      <div class="flex flex-1 overflow-hidden">
        <Switch>
          <Match when={activeTab() === "overview"}>
            <div class="ui-pad flex flex-1 flex-col gap-4 overflow-auto">
              <StateHolderWrapper state={detailQuery.state()}>
                {(detail: ProjectDetailType) => (
                  <Show
                    when={detail.importHistory.length > 0}
                    fallback={
                      <div class="text-base-content/40 text-sm">No imports yet</div>
                    }
                  >
                    <div class="ui-spy-sm flex flex-col">
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

              <Show when={p.isHUser}>
                <_ImportPanel projectId={p.projectId} onImported={detailQuery.silentFetch} />
              </Show>
            </div>
          </Match>

          <Match when={activeTab() === "visualizations"}>
            <div class="flex flex-1 overflow-hidden">
              <Switch>
                <Match when={editingPoId() !== undefined}>
                  <VisualizationEditor
                    projectId={p.projectId}
                    poId={editingPoId()!}
                    onClose={() => setEditingPoId(undefined)}
                    onSaved={() => setEditingPoId(undefined)}
                  />
                </Match>
                <Match when={true}>
                  <VisualizationsList
                    projectId={p.projectId}
                    onOpenEditor={(id) => setEditingPoId(id)}
                  />
                </Match>
              </Switch>
            </div>
          </Match>
        </Switch>
      </div>
    </div>
  );
}

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

  const importAction = timActionButton(
    async () => {
      const sId = selectedServerId();
      const pId = selectedProjectId();
      if (!sId || !pId) return { success: false as const, err: "Select a server and project" };
      const token = (await clerk.session?.getToken()) ?? "";
      return serverActions.importFromSource({
        sourceServerId: sId,
        sourceProjectId: pId,
        targetProjectId: p.projectId,
        token,
      });
    },
    async () => {
      setSelectedProjectId("");
      await p.onImported();
    },
  );

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
    <div class="ui-spy-sm flex flex-col gap-3">
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
        <Button
          intent="primary"
          state={importAction.state()}
          onClick={importAction.click}
          size="sm"
          disabled={!selectedServerId() || !selectedProjectId()}
        >
          Import
        </Button>
      </div>
    </div>
  );
}
