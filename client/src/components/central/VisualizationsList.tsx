import {
  Button,
  HeadingBar,
  StateHolderWrapper,
  Table,
  type TableColumn,
  timQuery,
} from "panther";
import { createMemo, Show } from "solid-js";
import { serverActions, type PresentationObjectSummary } from "~/server_actions";

type Props = {
  projectId: string;
  onOpenEditor: (id: string | null) => void;
};

export function VisualizationsList(p: Props) {
  const listQuery = timQuery(
    () => serverActions.listPresentationObjects({ projectId: p.projectId }),
    "Loading visualizations...",
  );

  const columns = createMemo((): TableColumn<PresentationObjectSummary>[] => [
    { key: "label", header: "Label", sortable: true },
    { key: "type", header: "Type", sortable: true },
    { key: "lastUpdated", header: "Last updated", sortable: true, render: (row) => new Date(row.lastUpdated).toLocaleString() },
  ]);

  return (
    <div class="flex h-full w-full min-w-0 flex-col">
      <HeadingBar heading="Visualizations" ensureHeightAsIfButton>
        <Button intent="primary" iconName="plus" size="sm" onClick={() => p.onOpenEditor(null)}>
          New visualization
        </Button>
      </HeadingBar>
      <div class="ui-pad flex flex-1 flex-col gap-4 overflow-auto">
        <StateHolderWrapper state={listQuery.state()}>
          {(items: PresentationObjectSummary[]) => (
            <Show
              when={items.length > 0}
              fallback={<div class="text-base-content/40 text-sm">No visualizations yet</div>}
            >
              <Table
                data={items}
                columns={columns()}
                keyField="id"
                onRowClick={(row) => p.onOpenEditor(row.id)}
              />
            </Show>
          )}
        </StateHolderWrapper>
      </div>
    </div>
  );
}
