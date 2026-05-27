import {
  Button,
  ChartHolder,
  HeadingBar,
  StateHolderWrapper,
  timQuery,
} from "panther";
import { createMemo, For, Show } from "solid-js";
import type { PeriodOption } from "platform-lib";
import {
  getFetchConfigFromPresentationObjectConfig,
  parsePresentationObjectConfig,
  type PresentationObjectConfig,
} from "platform-lib";
import { serverActions, type ProjectMetric, type PresentationObjectSummary } from "~/server_actions";
import { getFigureInputsFromPresentationObject } from "~/generate_visualization/get_figure_inputs_from_po";

type Props = {
  projectId: string;
  onOpenEditor: (id: string | null) => void;
};

export function VisualizationsList(p: Props) {
  const listQuery = timQuery(
    () => serverActions.listPresentationObjects({ projectId: p.projectId }),
    "Loading visualizations...",
  );

  const metricsQuery = timQuery(
    () => serverActions.getProjectMetrics({ projectId: p.projectId }),
    "Loading metrics...",
  );

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
            <StateHolderWrapper state={metricsQuery.state()}>
              {(metrics: ProjectMetric[]) => (
                <Show
                  when={items.length > 0}
                  fallback={<div class="text-base-content/40 text-sm">No visualizations yet</div>}
                >
                  <div class="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
                    <For each={items}>
                      {(item) => (
                        <_VizPreviewCard
                          projectId={p.projectId}
                          po={item}
                          metrics={metrics}
                          onOpenEditor={p.onOpenEditor}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              )}
            </StateHolderWrapper>
          )}
        </StateHolderWrapper>
      </div>
    </div>
  );
}

type CardProps = {
  projectId: string;
  po: PresentationObjectSummary;
  metrics: ProjectMetric[];
  onOpenEditor: (id: string | null) => void;
};

function _VizPreviewCard(p: CardProps) {
  const previewQuery = timQuery(async () => {
    const detail = await serverActions.getPresentationObject({ projectId: p.projectId, id: p.po.id });
    if (!detail.success) return { success: false as const, err: detail.err };

    const metric = p.metrics.find((m) => m.id === detail.data.metricId);
    if (!metric) return { success: false as const, err: "Metric not found" };

    let config: PresentationObjectConfig;
    try {
      config = parsePresentationObjectConfig(JSON.stringify(detail.data.config));
    } catch {
      return { success: false as const, err: "Invalid config" };
    }

    const fetchConfigResult = getFetchConfigFromPresentationObjectConfig(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { valueProps: JSON.parse(metric.valueProps ?? "[]"), valueFunc: metric.valueFunc, formatAs: metric.formatAs } as any,
      config,
    );
    if (!fetchConfigResult.success) {
      return { success: false as const, err: "Bad fetch config" };
    }

    const periodOpts = JSON.parse(metric.requiredDisaggregationOptions ?? "[]") as string[];
    const firstPeriodOption = periodOpts.find(
      (d) => d === "period_id" || d === "year" || d === "quarter_id",
    ) as PeriodOption | undefined;

    const items = await serverActions.getPresentationObjectItems({
      projectId: p.projectId,
      resultsObjectId: metric.resultsObjectId,
      fetchConfig: fetchConfigResult.data,
      firstPeriodOption,
      moduleLastRun: metric.lastRunAt,
    });
    if (!items.success) return { success: false as const, err: items.err };

    return { success: true as const, data: { config, metric, items: items.data } };
  }, "Loading...");

  const chartData = createMemo(() => {
    const s = previewQuery.state();
    if (s.status !== "ready" || !s.data) return null;
    const { config, metric, items } = s.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!items || (items as any).status !== "ok") return null;

    const fi = getFigureInputsFromPresentationObject(
      {
        id: metric.id,
        valueProps: JSON.parse(metric.valueProps ?? "[]"),
        valueFunc: metric.valueFunc,
        formatAs: metric.formatAs as "percent" | "number",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items as any,
      config,
    );
    if (fi.status !== "ready") return null;
    return fi.data;
  });

  return (
    <button
      type="button"
      class="border-base-300 hover:border-primary flex cursor-pointer flex-col gap-2 rounded border p-3 text-left transition-colors"
      onClick={() => p.onOpenEditor(p.po.id)}
    >
      <div class="truncate text-sm font-600">{p.po.label}</div>
      <div class="bg-base-200 aspect-video w-full overflow-hidden rounded">
        <Show
          when={chartData()}
          keyed
          fallback={
            <div class="text-base-content/40 flex h-full items-center justify-center text-xs">
              <Show
                when={previewQuery.state().status === "loading"}
                fallback={<span>No preview</span>}
              >
                <span>Loading...</span>
              </Show>
            </div>
          }
        >
          {(data) => (
            <ChartHolder
              chartInputs={data}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              height={"tableData" in (data as any) ? "ideal" : "flex"}
              scalePixelResolution={0.2}
              noRescaleWithWidthChange
            />
          )}
        </Show>
      </div>
      <div class="text-base-content/40 text-xs">{p.po.type}</div>
    </button>
  );
}
