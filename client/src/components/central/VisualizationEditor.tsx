import {
  Button,
  ChartHolder,
  FrameLeftResizable,
  FrameTop,
  Input,
  StateHolderWrapper,
  openAlert,
  openComponent,
  openConfirm,
  timActionButton,
  timQuery,
} from "panther";
import { Match, Show, Switch, createEffect, createMemo, createSignal, onMount } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import type {
  PresentationObjectConfig,
  PresentationObjectDetail as PlatformPODetail,
  ResultsValue,
  ResultsValueInfoForPresentationObject,
} from "platform-lib";
import {
  getFetchConfigFromPresentationObjectConfig,
  getDisaggregationAllowedPresentationOptions,
  getNextAvailableDisaggregationDisplayOption,
  get_DISAGGREGATION_DISPLAY_OPTIONS,
} from "platform-lib";
import { isCentralDisaggregationOption, parseCentralPresentationObjectConfig } from "~/disaggregation_helpers";
import {
  serverActions,
  type ProjectMetric,
  type PresentationObjectDetail as CentralPODetail,
} from "~/server_actions";
import { getFigureInputsFromPresentationObject } from "~/generate_visualization/get_figure_inputs_from_po";
import { PresentationObjectEditorPanel } from "~/components/visualization/presentation_object_editor_panel";
import {
  AddVisualizationModal,
  type AddVisualizationModalProps,
  type AddVisualizationResult,
} from "~/components/central/AddVisualizationModal";

// ─── Edit ─────────────────────────────────────────────────────────────────────

type EditProps = {
  projectId: string;
  poId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function VisualizationEditorEdit(p: EditProps) {
  type CombinedData = {
    poDetail: CentralPODetail;
    metric: ProjectMetric;
    config: PresentationObjectConfig;
  };

  const query = timQuery<CombinedData>(async () => {
    const [metricsRes, poRes] = await Promise.all([
      serverActions.getProjectMetrics({ projectId: p.projectId }),
      serverActions.getPresentationObject({ projectId: p.projectId, id: p.poId }),
    ]);
    if (!metricsRes.success) return metricsRes;
    if (!poRes.success) return poRes;
    const metric = metricsRes.data.find((m) => m.id === poRes.data.metricId);
    if (!metric) return { success: false, err: "Metric not found" } as const;
    try {
      const config = parseCentralPresentationObjectConfig(JSON.stringify(poRes.data.config));
      return { success: true, data: { poDetail: poRes.data, metric, config } } as const;
    } catch {
      return { success: false, err: "Invalid config" } as const;
    }
  }, "Loading...");

  return (
    <div class="flex h-full w-full min-w-0 flex-col">
      <StateHolderWrapper state={query.state()}>
        {(data: CombinedData) => (
          <_EditorActive
            projectId={p.projectId}
            poId={p.poId}
            metric={data.metric}
            initialLabel={data.poDetail.label}
            initialConfig={data.config}
            onClose={p.onClose}
            onSaved={() => p.onSaved()}
          />
        )}
      </StateHolderWrapper>
    </div>
  );
}

// ─── Create ───────────────────────────────────────────────────────────────────

type CreateProps = {
  projectId: string;
  onClose: () => void;
  onSaved: (newId: string) => void;
};

export function VisualizationEditorCreate(p: CreateProps) {
  const metricsQuery = timQuery(
    () => serverActions.getProjectMetrics({ projectId: p.projectId }),
    "Loading metrics...",
  );

  return (
    <div class="flex h-full w-full min-w-0 flex-col">
      <StateHolderWrapper state={metricsQuery.state()}>
        {(metrics: ProjectMetric[]) => (
          <_CreateWithMetrics
            projectId={p.projectId}
            metrics={metrics}
            onClose={p.onClose}
            onSaved={p.onSaved}
          />
        )}
      </StateHolderWrapper>
    </div>
  );
}

type CreateWithMetricsProps = {
  projectId: string;
  metrics: ProjectMetric[];
  onClose: () => void;
  onSaved: (newId: string) => void;
};

function _CreateWithMetrics(p: CreateWithMetricsProps) {
  const [readyConfig, setReadyConfig] = createSignal<{
    metric: ProjectMetric;
    config: PresentationObjectConfig;
  } | null>(null);

  onMount(async () => {
    const result = await openComponent<AddVisualizationModalProps, AddVisualizationResult>({
      element: AddVisualizationModal,
      props: { metrics: p.metrics },
    });
    if (!result) {
      p.onClose();
      return;
    }
    try {
      const config = parseCentralPresentationObjectConfig(JSON.stringify(result.config));
      setReadyConfig({ metric: result.metric, config });
    } catch (e) {
      console.error("Failed to parse config from modal:", e);
      p.onClose();
    }
  });

  return (
    <Show when={readyConfig()} keyed>
      {(ready) => (
        <_EditorActive
          projectId={p.projectId}
          poId={null}
          metric={ready.metric}
          initialLabel=""
          initialConfig={ready.config}
          onClose={p.onClose}
          onSaved={(newId) => { if (newId) p.onSaved(newId); }}
        />
      )}
    </Show>
  );
}

// ─── Active Editor (shared) ───────────────────────────────────────────────────

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

  // Build resultsValue first so it can be used by the config patcher below.
  const resultsValue: ResultsValue = (() => {
    const requiredSet = new Set(
      (JSON.parse(p.metric.requiredDisaggregationOptions ?? "[]") as string[]).filter(isCentralDisaggregationOption),
    );
    const available = (JSON.parse(p.metric.availableDisaggregationOptions ?? "[]") as string[]).filter(
      isCentralDisaggregationOption,
    );
    const allValues = [...new Set([...requiredSet, ...available])];
    const disOpts = allValues.map((d) => ({
      value: d,
      isRequired: requiredSet.has(d),
      allowedPresentationOptions: getDisaggregationAllowedPresentationOptions(d as any),
    }));
    const periodCols = ["period_id", "quarter_id", "year"] as const;
    const mostGranular = disOpts.find((d) =>
      (periodCols as readonly string[]).includes(d.value),
    )?.value as (typeof periodCols)[number] | undefined;
    const parsedLabelReplacements = (() => {
      try { return p.metric.valueLabelReplacements ? JSON.parse(p.metric.valueLabelReplacements) as Record<string, string> : undefined; }
      catch { return undefined; }
    })();
    const parsedPostAggregationExpression = (() => {
      try { return p.metric.postAggregationExpression ? JSON.parse(p.metric.postAggregationExpression) : undefined; }
      catch { return undefined; }
    })();
    return {
      id: p.metric.id,
      resultsObjectId: p.metric.resultsObjectId,
      valueProps: JSON.parse(p.metric.valueProps ?? "[]"),
      valueFunc: p.metric.valueFunc as ResultsValue["valueFunc"],
      label: p.metric.label,
      variantLabel: p.metric.variantLabel ?? undefined,
      formatAs: p.metric.formatAs as "percent" | "number",
      disaggregationOptions: disOpts,
      mostGranularTimePeriodColumnInResultsFile: mostGranular,
      valueLabelReplacements: parsedLabelReplacements,
      postAggregationExpression: parsedPostAggregationExpression,
    };
  })();

  // Auto-patch: if a required disaggregation is missing from disaggregateBy (e.g. legacy
  // configs created before admin_area_1 was marked required), add it so the editor doesn't
  // show "Error with required disaggregator". The fix is not saved until the user clicks Save.
  const patchedInitialConfig = (() => {
    const config = structuredClone(p.initialConfig);
    const effectiveValueProps: string[] = JSON.parse(p.metric.valueProps ?? "[]");
    for (const disOpt of resultsValue.disaggregationOptions) {
      if (!disOpt.isRequired) continue;
      if (disOpt.allowedPresentationOptions && !disOpt.allowedPresentationOptions.includes(config.d.type)) continue;
      if (config.d.disaggregateBy.some((d) => d.disOpt === disOpt.value)) continue;
      let disDisplayOpt = getNextAvailableDisaggregationDisplayOption(
        resultsValue,
        config,
        disOpt.value as any,
        effectiveValueProps,
      );
      // "replicant" is not mapped to a figure dimension — it relies on selectedReplicantValue
      // to pre-filter data to one value. Central-server has no replicant-picker UI so
      // selectedReplicantValue is always undefined → "UNSELECTED" → empty data.
      // If a non-replicant option is still free, use it instead.
      if (disDisplayOpt === "replicant") {
        const existingOpts = new Set(config.d.disaggregateBy.map((d) => d.disDisplayOpt));
        const altOpt = (get_DISAGGREGATION_DISPLAY_OPTIONS()[config.d.type] ?? []).find(
          (o) => o.value !== "replicant" && o.value !== "mapArea" && !existingOpts.has(o.value),
        );
        if (altOpt) disDisplayOpt = altOpt.value;
      }
      config.d.disaggregateBy.push({ disOpt: disOpt.value as any, disDisplayOpt });
    }
    return config;
  })();

  const [tempConfig, setTempConfig] = createStore<PresentationObjectConfig>(
    structuredClone(patchedInitialConfig),
  );

  const poDetailForPanel: PlatformPODetail = {
    id: p.poId ?? "new",
    projectId: p.projectId,
    lastUpdated: new Date().toISOString(),
    label: p.initialLabel,
    resultsValue,
    config: patchedInitialConfig,
    isDefault: false,
    folderId: null,
  };

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

      const parsedPAE = (() => {
        try { return m.postAggregationExpression ? JSON.parse(m.postAggregationExpression) : undefined; }
        catch { return undefined; }
      })();

      // If a replicant disaggregation has no value selected yet but the user has applied a
      // filterBy for the same field, promote the first filter value to selectedReplicantValue.
      // This prevents the "UNSELECTED" sentinel (which matches nothing) while keeping a
      // single country's data (avoiding "Duplicate values" in figure generation).
      const replicantDis = cfg.d.disaggregateBy.find((d) => d.disDisplayOpt === "replicant");
      const replicantFieldFilter = replicantDis && cfg.d.selectedReplicantValue === undefined
        ? cfg.d.filterBy.find((f) => f.disOpt === replicantDis.disOpt && f.values.length > 0)
        : undefined;
      const effectiveCfg = replicantFieldFilter
        ? {
            ...cfg,
            d: {
              ...cfg.d,
              selectedReplicantValue: String(replicantFieldFilter.values[0]),
              filterBy: cfg.d.filterBy.filter((f) => f.disOpt !== replicantDis!.disOpt),
            },
          }
        : cfg;

      const fetchConfigResult = getFetchConfigFromPresentationObjectConfig(
        { valueProps: JSON.parse(m.valueProps ?? "[]"), valueFunc: m.valueFunc, formatAs: m.formatAs, postAggregationExpression: parsedPAE } as any,
        effectiveCfg,
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
    for (const k in tempConfig.d) { (tempConfig.d as any)[k]; }
    for (const dis of tempConfig.d.disaggregateBy) { dis.disOpt; dis.disDisplayOpt; }
    for (const fil of tempConfig.d.filterBy ?? []) { fil.disOpt; fil.values.join(","); }
    const _pf = tempConfig.d.periodFilter;
    if (_pf) {
      _pf.filterType;
      if (_pf.filterType === "last_n_months") _pf.nMonths;
      if (_pf.filterType === "last_n_calendar_years") _pf.nYears;
      if (_pf.filterType === "last_n_calendar_quarters") _pf.nQuarters;
      if (_pf.filterType === "custom" || _pf.filterType === "from_month") { _pf.min; _pf.max; }
    }

    if (firstItemsFetch) { firstItemsFetch = false; return; }
    itemsQuery.fetch();
  });

  const figureInputs = createMemo(() => {
    const s = itemsQuery.state();
    if (s.status !== "ready" || !s.data) return null;
    const ih = s.data;
    if (!ih || (ih as any).status !== "ok") return null;

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
    <FrameTop
      panelChildren={
        <div class="ui-pad ui-gap flex items-center border-b">
          <div class="ui-gap-sm flex items-center">
            <Button iconName="chevronLeft" onClick={p.onClose} />
          </div>
          <div class="flex flex-1 items-center truncate">
            <span class="font-400 truncate text-xl">
              {p.metric.label}
              {p.metric.variantLabel && (
                <span class="text-base-content/50"> — {p.metric.variantLabel}</span>
              )}
            </span>
          </div>
          <div class="ui-gap-sm flex flex-none items-center">
            <Input
              label="Label"
              value={label()}
              onChange={setLabel}
              placeholder="Visualization label"
            />
            <Button
              intent="success"
              iconName="save"
              state={{ status: saveLoading() ? "loading" : "ready" }}
              onClick={handleSave}
            >
              Save
            </Button>
            <Show when={p.poId}>
              <Button
                intent="danger"
                iconName="trash"
                outline
                state={deleteAction.state()}
                onClick={deleteAction.click}
              />
            </Show>
          </div>
        </div>
      }
    >
      <FrameLeftResizable
        startingWidth={384}
        minWidth={300}
        maxWidth={600}
        hoverOffset="offset-for-border-1-on-left"
        panelChildren={
          <Switch>
            <Match when={rvInfoQuery.state().status === "loading"}>
              <div class="ui-pad text-sm text-base-content/40">Loading...</div>
            </Match>
            <Match when={rvInfoQuery.state().status === "error"}>
              <div class="ui-pad text-danger text-sm">Error loading metric info</div>
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
        }
      >
        <div class="ui-pad h-full w-full overflow-auto">
          <Show
            when={figureInputs()}
            fallback={
              <div class="flex h-full items-center justify-center">
                <Switch>
                  <Match when={itemsQuery.state().status === "loading"}>
                    <span class="text-sm text-base-content/40">Loading data...</span>
                  </Match>
                  <Match when={true}>
                    <span class="text-sm text-base-content/40">No data available</span>
                  </Match>
                </Switch>
              </div>
            }
          >
            {(fi) => (
              <Show
                when={(fi() as any).status === "ready"}
                fallback={
                  <div class="text-danger text-sm">
                    {(fi() as any).status === "error" ? (fi() as any).err : ""}
                  </div>
                }
              >
                <ChartHolder chartInputs={(fi() as any).data} height="flex" />
              </Show>
            )}
          </Show>
        </div>
      </FrameLeftResizable>
    </FrameTop>
  );
}
