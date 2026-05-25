import {
  Button,
  ChartHolder,
  HeadingBar,
  Input,
  Select,
  StateHolderWrapper,
  openAlert,
  openConfirm,
  timActionButton,
  timQuery,
} from "panther";
import { Match, Show, Switch, createEffect, createMemo, createSignal } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import type {
  DisaggregationOption,
  PresentationObjectConfig,
  PresentationObjectDetail as PlatformPODetail,
  ResultsValue,
  ResultsValueInfoForPresentationObject,
} from "platform-lib";
import {
  getFetchConfigFromPresentationObjectConfig,
  getStartingConfigForPresentationObject,
  isDisaggregationOption,
  parsePresentationObjectConfig,
} from "platform-lib";
import {
  serverActions,
  type ProjectMetric,
  type PresentationObjectDetail as CentralPODetail,
} from "~/server_actions";
import { getFigureInputsFromPresentationObject } from "~/generate_visualization/get_figure_inputs_from_po";
import { PresentationObjectEditorPanel } from "~/components/visualization/presentation_object_editor_panel";

type Props = {
  projectId: string;
  poId: string | null;
  onClose: () => void;
  onSaved: (newId?: string) => void;
};

export function VisualizationEditor(p: Props) {
  const metricsQuery = timQuery(
    () => serverActions.getProjectMetrics({ projectId: p.projectId }),
    "Loading metrics...",
  );

  const poQuery = timQuery(
    () =>
      p.poId
        ? serverActions.getPresentationObject({ projectId: p.projectId, id: p.poId })
        : Promise.resolve({ success: false as const, err: "No PO" }),
    "Loading...",
  );

  return (
    <div class="flex h-full flex-col">
      <HeadingBar heading={p.poId ? "Edit visualization" : "New visualization"} ensureHeightAsIfButton>
        <Button intent="neutral" iconName="x" size="sm" onClick={p.onClose}>
          Close
        </Button>
      </HeadingBar>
      <div class="flex flex-1 overflow-hidden">
        <StateHolderWrapper state={metricsQuery.state()}>
          {(metrics: ProjectMetric[]) => (
            <Show
              when={p.poId !== null}
              fallback={
                <_EditorSetup
                  projectId={p.projectId}
                  poId={null}
                  poDetail={null}
                  metrics={metrics}
                  onClose={p.onClose}
                  onSaved={p.onSaved}
                />
              }
            >
              <StateHolderWrapper state={poQuery.state()}>
                {(poDetail: CentralPODetail) => (
                  <_EditorSetup
                    projectId={p.projectId}
                    poId={p.poId!}
                    poDetail={poDetail}
                    metrics={metrics}
                    onClose={p.onClose}
                    onSaved={p.onSaved}
                  />
                )}
              </StateHolderWrapper>
            </Show>
          )}
        </StateHolderWrapper>
      </div>
    </div>
  );
}

type SetupProps = {
  projectId: string;
  poId: string | null;
  poDetail: CentralPODetail | null;
  metrics: ProjectMetric[];
  onClose: () => void;
  onSaved: (newId?: string) => void;
};

function _EditorSetup(p: SetupProps) {
  const [metricId, setMetricId] = createSignal(p.poDetail?.metricId ?? "");

  const initReadyConfig = (() => {
    if (!p.poDetail) return null;
    const m = p.metrics.find((m) => m.id === p.poDetail!.metricId);
    if (!m) return null;
    try {
      const c = parsePresentationObjectConfig(JSON.stringify(p.poDetail.config));
      return { m, c };
    } catch {
      return null;
    }
  })();

  const [readyConfig, setReadyConfig] = createSignal<{
    m: ProjectMetric;
    c: PresentationObjectConfig;
  } | null>(initReadyConfig);

  createEffect(() => {
    if (p.poId !== null) return;
    if (readyConfig() !== null) return;
    const mId = metricId();
    const m = p.metrics.find((m) => m.id === mId);
    if (!m) return;

    const disOpts = (JSON.parse(m.requiredDisaggregationOptions ?? "[]") as string[])
      .filter(isDisaggregationOption)
      .map((d: DisaggregationOption) => ({ value: d, isRequired: true }));
    const periodCols = ["period_id", "quarter_id", "year"] as const;
    const mostGranular = disOpts.find((d) =>
      (periodCols as readonly string[]).includes(d.value),
    )?.value as (typeof periodCols)[number] | undefined;

    const fakeRv = {
      id: m.id,
      resultsObjectId: m.resultsObjectId,
      valueProps: JSON.parse(m.valueProps ?? "[]"),
      valueFunc: m.valueFunc,
      label: m.label,
      formatAs: m.formatAs,
      valueLabelReplacements: undefined,
      disaggregationOptions: disOpts,
      mostGranularTimePeriodColumnInResultsFile: mostGranular,
    };

    try {
      const startingConfig = getStartingConfigForPresentationObject(
        fakeRv as any,
        "chart",
        [],
      );
      const c = parsePresentationObjectConfig(JSON.stringify(startingConfig));
      setReadyConfig({ m, c });
    } catch (e) {
      console.error("Failed to generate starting config:", e);
    }
  });

  return (
    <div class="flex flex-1 flex-col overflow-hidden">
      <Show when={!p.poId}>
        <div class="flex-none border-b p-3">
          <Select
            label="Select metric"
            value={metricId() || undefined}
            options={p.metrics
              .filter((m) => !m.hide)
              .map((m) => ({
                value: m.id,
                label: m.label + (m.variantLabel ? ` — ${m.variantLabel}` : ""),
              }))}
            onChange={setMetricId}
            placeholder="Select metric..."
            fullWidth
          />
        </div>
      </Show>

      <Show when={readyConfig()} keyed>
        {(ready) => (
          <_EditorActive
            projectId={p.projectId}
            poId={p.poId}
            metric={ready.m}
            initialLabel={p.poDetail?.label ?? ""}
            initialConfig={ready.c}
            onClose={p.onClose}
            onSaved={p.onSaved}
          />
        )}
      </Show>
    </div>
  );
}

type ActiveProps = {
  projectId: string;
  poId: string | null;
  metric: ProjectMetric;
  initialLabel: string;
  initialConfig: PresentationObjectConfig;
  onClose: () => void;
  onSaved: (newId?: string) => void;
};

function _EditorActive(p: ActiveProps) {
  const [label, setLabel] = createSignal(p.initialLabel);
  const [tempConfig, setTempConfig] = createStore<PresentationObjectConfig>(
    structuredClone(p.initialConfig),
  );

  const poDetailForPanel: PlatformPODetail = (() => {
    const disOpts = (JSON.parse(p.metric.requiredDisaggregationOptions ?? "[]") as string[])
      .filter(isDisaggregationOption)
      .map((d: DisaggregationOption) => ({ value: d, isRequired: true }));
    const periodCols = ["period_id", "quarter_id", "year"] as const;
    const mostGranular = disOpts.find((d) =>
      (periodCols as readonly string[]).includes(d.value),
    )?.value as (typeof periodCols)[number] | undefined;

    const resultsValue: ResultsValue = {
      id: p.metric.id,
      resultsObjectId: p.metric.resultsObjectId,
      valueProps: JSON.parse(p.metric.valueProps ?? "[]"),
      valueFunc: p.metric.valueFunc as ResultsValue["valueFunc"],
      label: p.metric.label,
      variantLabel: p.metric.variantLabel ?? undefined,
      formatAs: p.metric.formatAs as "percent" | "number",
      disaggregationOptions: disOpts,
      mostGranularTimePeriodColumnInResultsFile: mostGranular,
    };

    return {
      id: p.poId ?? "new",
      projectId: p.projectId,
      lastUpdated: new Date().toISOString(),
      label: p.initialLabel,
      resultsValue,
      config: p.initialConfig,
      isDefault: false,
      folderId: null,
    };
  })();

  const rvInfoQuery = timQuery(
    () =>
      serverActions.getResultsValueInfo({
        projectId: p.projectId,
        metricId: p.metric.id,
        moduleLastRun: p.metric.lastRunAt,
      }),
    "Loading metric info...",
  );

  const itemsQuery = timQuery(
    () => {
      const m = p.metric;
      const cfg = unwrap(tempConfig);

      const fetchConfigResult = getFetchConfigFromPresentationObjectConfig(
        { valueProps: JSON.parse(m.valueProps ?? "[]"), valueFunc: m.valueFunc, formatAs: m.formatAs } as any,
        cfg,
      );
      if (!fetchConfigResult.success) return Promise.resolve({ success: true as const, data: null });

      const periodOpts = JSON.parse(m.requiredDisaggregationOptions ?? "[]");
      const firstPeriodOption = periodOpts.find(
        (d: string) => d === "period_id" || d === "year" || d === "quarter_id",
      );

      return serverActions.getPresentationObjectItems({
        projectId: p.projectId,
        resultsObjectId: m.resultsObjectId,
        fetchConfig: fetchConfigResult.data,
        firstPeriodOption,
        moduleLastRun: m.lastRunAt,
      });
    },
    "Loading chart data...",
  );

  let firstItemsFetch = true;
  createEffect(() => {
    // Explicitly read all data-config properties so SolidJS tracks each one.
    // JSON.stringify on store proxies does not reliably trigger tracking.
    for (const k in tempConfig.d) { (tempConfig.d as any)[k]; }
    for (const dis of tempConfig.d.disaggregateBy) { dis.disOpt; dis.disDisplayOpt; }
    for (const fil of tempConfig.d.filterBy ?? []) { fil.disOpt; fil.values.join(","); }
    const _pf = tempConfig.d.periodFilter;
    if (_pf) {
      _pf.filterType;
      if (_pf.filterType === "last_n_months") _pf.nMonths;
      if (_pf.filterType === "last_n_calendar_years") _pf.nYears;
      if (_pf.filterType === "last_n_calendar_quarters") _pf.nQuarters;
      if (_pf.filterType === "custom" || _pf.filterType === "from_month") {
        _pf.min; _pf.max;
      }
    }

    if (firstItemsFetch) { firstItemsFetch = false; return; }
    itemsQuery.fetch();
  });

  // Recompute figure inputs when items change (re-fetch) OR when style/text changes.
  // Uses explicit property reads to register reactive tracking on store proxies.
  const figureInputs = createMemo(() => {
    const s = itemsQuery.state();
    if (s.status !== "ready" || !s.data) return null;
    const ih = s.data;
    if (!ih || (ih as any).status !== "ok") return null;

    // Track style and text changes so the preview rerenders without a re-fetch.
    for (const k in tempConfig.s) { (tempConfig.s as any)[k]; }
    for (const k in tempConfig.t) { (tempConfig.t as any)[k]; }

    const cfg = unwrap(tempConfig);
    return getFigureInputsFromPresentationObject(
      poDetailForPanel.resultsValue as any,
      ih as any,
      cfg,
    );
  });

  const [saveLoading, setSaveLoading] = createSignal(false);

  const handleSave = async () => {
    const lbl = label().trim();
    const cfg = unwrap(tempConfig);
    if (!lbl) {
      await openAlert({ title: "Error", text: "Label required", intent: "danger" });
      return;
    }
    setSaveLoading(true);
    try {
      if (p.poId) {
        await serverActions.updatePresentationObjectLabel({
          projectId: p.projectId,
          id: p.poId,
          label: lbl,
        });
        const r = await serverActions.updatePresentationObjectConfig({
          projectId: p.projectId,
          id: p.poId,
          config: cfg,
        });
        if (!r.success) {
          await openAlert({ title: "Error", text: r.err, intent: "danger" });
          return;
        }
        p.onSaved();
      } else {
        const r = await serverActions.createPresentationObject({
          projectId: p.projectId,
          metricId: p.metric.id,
          label: lbl,
          config: cfg,
        });
        if (!r.success) {
          await openAlert({ title: "Error", text: r.err, intent: "danger" });
          return;
        }
        p.onSaved(r.data.id);
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const deleteAction = timActionButton(
    async () => {
      if (!p.poId) return { success: false as const, err: "No ID" };
      const confirmed = await openConfirm({ text: "Delete this visualization?" });
      if (!confirmed) return { success: false as const, err: "Cancelled" };
      return serverActions.deletePresentationObject({
        projectId: p.projectId,
        id: p.poId,
      });
    },
    p.onSaved,
  );

  return (
    <div class="flex flex-1 flex-col overflow-hidden">
      <div class="flex flex-none items-center gap-2 border-b p-2">
        <div class="min-w-0 flex-1">
          <Input
            label="Label"
            value={label()}
            onChange={setLabel}
            placeholder="Visualization label"
            fullWidth
          />
        </div>
        <div class="flex flex-none flex-col gap-1">
          <Button
            intent="primary"
            size="sm"
            state={{ status: saveLoading() ? "loading" : "ready" }}
            onClick={handleSave}
            iconName="save"
          >
            Save
          </Button>
          <Show when={p.poId}>
            <Button
              intent="danger"
              size="sm"
              outline
              state={deleteAction.state()}
              onClick={deleteAction.click}
              iconName="trash"
            >
              Delete
            </Button>
          </Show>
        </div>
      </div>

      <div class="flex flex-1 overflow-hidden">
        <div class="h-full w-96 flex-none">
          <Switch>
            <Match when={rvInfoQuery.state().status === "loading"}>
              <div class="ui-pad text-sm text-base-content/40">Loading...</div>
            </Match>
            <Match when={rvInfoQuery.state().status === "error"}>
              <div class="ui-pad text-sm text-danger">
                Error loading metric info
              </div>
            </Match>
            <Match
              when={
                rvInfoQuery.state().status === "ready" &&
                (rvInfoQuery.state() as any).data !== null
              }
            >
              <PresentationObjectEditorPanel
                projectId={p.projectId}
                poDetail={poDetailForPanel}
                resultsValueInfo={
                  (rvInfoQuery.state() as any).data as ResultsValueInfoForPresentationObject
                }
                tempConfig={tempConfig}
                setTempConfig={setTempConfig}
              />
            </Match>
          </Switch>
        </div>

        <div class="flex flex-1 flex-col overflow-auto p-4">
          <div class="mb-3 text-xs font-600 uppercase tracking-wider text-base-content/60">
            Preview
          </div>
          <Show
            when={figureInputs()}
            fallback={
              <Switch>
                <Match when={itemsQuery.state().status === "loading"}>
                  <div class="text-sm text-base-content/40">Loading data...</div>
                </Match>
                <Match when={true}>
                  <div class="text-sm text-base-content/40">No data available</div>
                </Match>
              </Switch>
            }
          >
            {(fi) => (
              <Show
                when={(fi() as any).status === "ready"}
                fallback={
                  <div class="text-sm text-base-content/40">
                    {(fi() as any).status === "error" ? (fi() as any).err : "No preview"}
                  </div>
                }
              >
                <ChartHolder chartInputs={(fi() as any).data} height={500} />
              </Show>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}
