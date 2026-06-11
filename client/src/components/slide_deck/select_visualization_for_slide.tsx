import {
  Button,
  type AlertComponentProps,
  FrameTop,
  HeadingBar,
  openAlert,
} from "panther";
import type { FigureBlock, PeriodOption } from "platform-lib";
import { getFetchConfigFromPresentationObjectConfig } from "platform-lib";
import { createSignal, For, Show } from "solid-js";
import { parseCentralPresentationObjectConfig } from "~/disaggregation_helpers";
import { serverActions, type PresentationObjectSummary } from "~/server_actions";
import { getFigureInputsFromPresentationObject } from "~/generate_visualization/get_figure_inputs_from_po";
import { projectState } from "~/state/project/t1_store";

type Props = AlertComponentProps<{ projectId: string }, FigureBlock>;

export function SelectVisualizationForSlide(p: Props) {
  const [selectedPo, setSelectedPo] = createSignal<PresentationObjectSummary | undefined>();
  const [isComputing, setIsComputing] = createSignal(false);
  const [searchText, setSearchText] = createSignal("");

  const filteredList = () => {
    const items = projectState.visualizations;
    const q = searchText().toLowerCase().trim();
    if (!q) return items;
    return items.filter((po) => po.label.toLowerCase().includes(q));
  };

  async function handleSelect() {
    const po = selectedPo();
    if (!po) return;

    const metrics = projectState.metrics;

    setIsComputing(true);
    try {
      const detail = await serverActions.getPresentationObject({
        projectId: p.projectId,
        id: po.id,
      });
      if (!detail.success) {
        await openAlert({ text: detail.err, intent: "danger" });
        setIsComputing(false);
        return;
      }

      const metric = metrics.find((m) => m.id === detail.data.metricId);
      if (!metric) {
        await openAlert({ text: "Metric not found for this visualization", intent: "danger" });
        setIsComputing(false);
        return;
      }

      let config;
      try {
        config = parseCentralPresentationObjectConfig(JSON.stringify(detail.data.config));
      } catch {
        await openAlert({ text: "Invalid visualization config", intent: "danger" });
        setIsComputing(false);
        return;
      }

      const parsedPostAggExpr = (() => {
        try {
          return metric.postAggregationExpression
            ? JSON.parse(metric.postAggregationExpression)
            : undefined;
        } catch {
          return undefined;
        }
      })();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchConfigResult = getFetchConfigFromPresentationObjectConfig(
        {
          valueProps: JSON.parse(metric.valueProps ?? "[]"),
          valueFunc: metric.valueFunc,
          formatAs: metric.formatAs,
          postAggregationExpression: parsedPostAggExpr,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        config,
      );
      if (!fetchConfigResult.success) {
        await openAlert({ text: "Failed to build fetch config", intent: "danger" });
        setIsComputing(false);
        return;
      }

      const periodOpts = JSON.parse(metric.requiredDisaggregationOptions ?? "[]") as string[];
      const firstPeriodOption = periodOpts.find(
        (d) => d === "period_id" || d === "year" || d === "quarter_id",
      ) as PeriodOption | undefined;

      const itemsRes = await serverActions.getPresentationObjectItems({
        projectId: p.projectId,
        resultsObjectId: metric.resultsObjectId,
        fetchConfig: fetchConfigResult.data,
        firstPeriodOption,
        moduleLastRun: metric.lastRunAt,
      });
      if (!itemsRes.success) {
        await openAlert({ text: itemsRes.err, intent: "danger" });
        setIsComputing(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((itemsRes.data as any).status !== "ok") {
        await openAlert({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          text: `Cannot use this visualization: ${(itemsRes.data as any).status}`,
          intent: "danger",
        });
        setIsComputing(false);
        return;
      }

      const figureInputsRes = getFigureInputsFromPresentationObject(
        {
          id: metric.id,
          valueProps: JSON.parse(metric.valueProps ?? "[]"),
          valueFunc: metric.valueFunc,
          formatAs: metric.formatAs as "percent" | "number",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        itemsRes.data as any,
        config,
      );

      if (figureInputsRes.status !== "ready") {
        await openAlert({ text: "Failed to generate figure inputs", intent: "danger" });
        setIsComputing(false);
        return;
      }

      p.close({ type: "figure", figureInputs: figureInputsRes.data });
    } catch (e) {
      await openAlert({
        text: e instanceof Error ? e.message : "Failed to select visualization",
        intent: "danger",
      });
      setIsComputing(false);
    }
  }

  return (
    <FrameTop
      panelChildren={
        <HeadingBar
          heading="Select Visualization"
          searchText={searchText()}
          setSearchText={setSearchText}
        >
          <div class="ui-gap-sm flex">
            <Button
              onClick={handleSelect}
              intent="success"
              disabled={!selectedPo() || isComputing()}
              iconName="check"
            >
              {isComputing() ? "Computing..." : "Select"}
            </Button>
            <Button onClick={() => p.close(undefined)} intent="neutral" iconName="x">
              Cancel
            </Button>
          </div>
        </HeadingBar>
      }
    >
      <div class="h-full overflow-auto">
        <For each={filteredList()}>
          {(po) => (
            <div
              class="cursor-pointer border-b px-4 py-3 hover:bg-base-100"
              classList={{
                "bg-primary/10": selectedPo()?.id === po.id,
                "border-base-200": selectedPo()?.id !== po.id,
                "border-primary": selectedPo()?.id === po.id,
              }}
              onClick={() => setSelectedPo(po)}
            >
              <div class="text-sm font-medium">{po.label}</div>
            </div>
          )}
        </For>
        <Show when={filteredList().length === 0}>
          <div class="text-base-content/40 p-8 text-center text-sm">
            {searchText() ? "No matching visualizations" : "No visualizations available"}
          </div>
        </Show>
      </div>
    </FrameTop>
  );
}
