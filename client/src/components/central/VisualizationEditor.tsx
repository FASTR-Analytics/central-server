import {
  Button,
  ChartHolder,
  Checkbox,
  HeadingBar,
  Input,
  Select,
  StateHolderWrapper,
  TextArea,
  openAlert,
  openConfirm,
  timActionButton,
  timQuery,
} from "panther";
import { For, createEffect, createSignal, Match, Show, Switch } from "solid-js";
import type {
  DisaggregationOption,
  PresentationObjectConfig,
  PresentationOption,
  ResultsValueForVisualization,
} from "platform-lib";
import {
  convertVisualizationType,
  getFetchConfigFromPresentationObjectConfig,
  getNextAvailableDisaggregationDisplayOption,
  getStartingConfigForPresentationObject,
  get_PRESENTATION_SELECT_OPTIONS,
  isDisaggregationOption,
  parsePresentationObjectConfig,
} from "platform-lib";
import { serverActions, type ProjectMetric, type PresentationObjectDetail } from "~/server_actions";
import { getFigureInputsFromPresentationObject } from "~/generate_visualization/get_figure_inputs_from_po";

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
    () => p.poId
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
                <_EditorInner
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
                {(poDetail: PresentationObjectDetail) => (
                  <_EditorInner
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

type InnerProps = {
  projectId: string;
  poId: string | null;
  poDetail: PresentationObjectDetail | null;
  metrics: ProjectMetric[];
  onClose: () => void;
  onSaved: (newId?: string) => void;
};

function _EditorInner(p: InnerProps) {
  const initialMetricId = p.poDetail?.metricId ?? "";
  const initialLabel = p.poDetail?.label ?? "";
  const initialConfig = p.poDetail?.config ?? null;

  const [metricId, setMetricId] = createSignal(initialMetricId);
  const [label, setLabel] = createSignal(initialLabel);
  const [config, setConfig] = createSignal<unknown>(initialConfig);
  const [rawConfigText, setRawConfigText] = createSignal(
    initialConfig ? JSON.stringify(initialConfig, null, 2) : "",
  );

  const selectedMetric = () => p.metrics.find((m) => m.id === metricId());

  // Parsed config derived value
  const parsedConfig = (): PresentationObjectConfig | null => {
    const cfg = config();
    if (!cfg) return null;
    try {
      return parsePresentationObjectConfig(JSON.stringify(cfg));
    } catch {
      return null;
    }
  };

  // Auto-generate starting config when metric selected in create mode
  createEffect(() => {
    const mId = metricId();
    if (p.poId !== null) return;
    if (config() !== null) return;
    const m = p.metrics.find((m) => m.id === mId);
    if (!m) return;

    const disOpts = (JSON.parse(m.requiredDisaggregationOptions ?? "[]") as string[])
      .filter(isDisaggregationOption)
      .map((d: DisaggregationOption) => ({ value: d, isRequired: true }));

    const periodCols = ["period_id", "quarter_id", "year"] as const;
    const mostGranular = disOpts.find((d) => (periodCols as readonly string[]).includes(d.value))
      ?.value as typeof periodCols[number] | undefined;

    const fakeRv = {
      id: m.id,
      resultsObjectId: m.resultsObjectId,
      valueProps: JSON.parse(m.valueProps ?? "[]"),
      valueFunc: "SUM",
      label: m.label,
      formatAs: m.formatAs as "percent" | "number",
      valueLabelReplacements: undefined,
      disaggregationOptions: disOpts,
      mostGranularTimePeriodColumnInResultsFile: mostGranular,
    };

    const startingConfig = getStartingConfigForPresentationObject(fakeRv as any, "chart", []);
    setConfig(startingConfig);
  });

  // Sync config → rawConfigText (for external changes: type selector, disagg toggle, auto-generate)
  createEffect(() => {
    const cfg = config();
    setRawConfigText(cfg ? JSON.stringify(cfg, null, 2) : "");
  });

  // Fetch results value info when metric changes
  const rvInfoQuery = timQuery(
    () => {
      const m = selectedMetric();
      if (!m) return Promise.resolve({ success: true as const, data: null });
      return serverActions.getResultsValueInfo({
        projectId: p.projectId,
        metricId: m.id,
        moduleLastRun: m.lastRunAt,
      });
    },
    "Loading metric info...",
  );

  createEffect(() => {
    metricId();
    rvInfoQuery.fetch();
  });

  // Fetch chart items when config + metric are ready
  const itemsQuery = timQuery(
    () => {
      const m = selectedMetric();
      const cfg = config();
      if (!m || !cfg) return Promise.resolve({ success: true as const, data: null });

      let parsed: PresentationObjectConfig;
      try {
        parsed = parsePresentationObjectConfig(JSON.stringify(cfg));
      } catch {
        return Promise.resolve({ success: true as const, data: null });
      }

      const resultsValue: ResultsValueForVisualization = {
        valueProps: JSON.parse(m.valueProps ?? "[]"),
        formatAs: m.formatAs as "percent" | "number",
      };

      const fetchConfigResult = getFetchConfigFromPresentationObjectConfig(resultsValue as any, parsed);
      if (!fetchConfigResult.success) return Promise.resolve({ success: true as const, data: null });

      const periodOpts = JSON.parse(m.requiredDisaggregationOptions ?? "[]");
      const firstPeriodOption = periodOpts.find((d: string) =>
        d === "period_id" || d === "year" || d === "quarter_id"
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

  createEffect(() => {
    config();
    itemsQuery.fetch();
  });

  // Presentation type options for the current metric
  const presentationTypeOptions = () => {
    const m = selectedMetric();
    if (!m) return get_PRESENTATION_SELECT_OPTIONS();
    const disOpts = (JSON.parse(m.requiredDisaggregationOptions ?? "[]") as string[])
      .filter(isDisaggregationOption)
      .map((d: DisaggregationOption) => ({ value: d }));
    return get_PRESENTATION_SELECT_OPTIONS(disOpts);
  };

  const handleTypeChange = (newType: string) => {
    const pc = parsedConfig();
    if (!pc) return;
    const m = selectedMetric();
    if (!m) return;
    const disOpts = (JSON.parse(m.requiredDisaggregationOptions ?? "[]") as string[])
      .filter(isDisaggregationOption)
      .map((d: DisaggregationOption) => ({ value: d, isRequired: true }));
    try {
      const converted = convertVisualizationType(pc, newType as PresentationOption, disOpts);
      setConfig(converted);
    } catch {}
  };

  // Available disaggregation options from the selected metric
  const availableDisaggOptions = (): DisaggregationOption[] => {
    const m = selectedMetric();
    if (!m) return [];
    return (JSON.parse(m.requiredDisaggregationOptions ?? "[]") as string[])
      .filter(isDisaggregationOption) as DisaggregationOption[];
  };

  const activeDisaggOptions = (): Set<DisaggregationOption> => {
    const pc = parsedConfig();
    if (!pc) return new Set();
    return new Set(pc.d.disaggregateBy.map((d) => d.disOpt));
  };

  const handleDisaggToggle = (disOpt: DisaggregationOption, checked: boolean) => {
    const pc = parsedConfig();
    if (!pc) return;
    const m = selectedMetric();
    if (!m) return;
    if (checked) {
      const rv: ResultsValueForVisualization = {
        formatAs: m.formatAs as "percent" | "number",
        valueProps: JSON.parse(m.valueProps ?? "[]"),
      };
      const disDisplayOpt = getNextAvailableDisaggregationDisplayOption(
        rv,
        pc,
        disOpt,
        rv.valueProps,
      );
      setConfig({
        ...pc,
        d: { ...pc.d, disaggregateBy: [...pc.d.disaggregateBy, { disOpt, disDisplayOpt }] },
      });
    } else {
      setConfig({
        ...pc,
        d: { ...pc.d, disaggregateBy: pc.d.disaggregateBy.filter((d) => d.disOpt !== disOpt) },
      });
    }
  };

  const handleApplyConfig = () => {
    try {
      const parsed = JSON.parse(rawConfigText());
      setConfig(parsed);
    } catch {}
  };

  const [saveLoading, setSaveLoading] = createSignal(false);

  const handleSave = async () => {
    const lbl = label().trim();
    const mId = metricId();
    const cfg = config();
    if (!lbl) { await openAlert({ title: "Error", text: "Label required", intent: "danger" }); return; }
    if (!mId) { await openAlert({ title: "Error", text: "Select a metric", intent: "danger" }); return; }
    setSaveLoading(true);
    try {
      if (p.poId) {
        await serverActions.updatePresentationObjectLabel({ projectId: p.projectId, id: p.poId, label: lbl });
        const r = await serverActions.updatePresentationObjectConfig({ projectId: p.projectId, id: p.poId, config: cfg });
        if (!r.success) { await openAlert({ title: "Error", text: r.err, intent: "danger" }); return; }
        p.onSaved();
      } else {
        const r = await serverActions.createPresentationObject({ projectId: p.projectId, metricId: mId, label: lbl, config: cfg ?? {} });
        if (!r.success) { await openAlert({ title: "Error", text: r.err, intent: "danger" }); return; }
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
      return serverActions.deletePresentationObject({ projectId: p.projectId, id: p.poId });
    },
    p.onSaved,
  );

  const figureInputs = () => {
    const s = itemsQuery.state();
    if (s.status !== "ready" || !s.data) return null;
    const ih = s.data;
    if (!ih || ih.status !== "ok") return null;
    const m = selectedMetric();
    if (!m) return null;
    const cfg = config();
    if (!cfg) return null;
    let parsed: PresentationObjectConfig;
    try {
      parsed = parsePresentationObjectConfig(JSON.stringify(cfg));
    } catch {
      return null;
    }
    const resultsValue: ResultsValueForVisualization = {
      valueProps: JSON.parse(m.valueProps ?? "[]"),
      formatAs: m.formatAs as "percent" | "number",
    };
    return getFigureInputsFromPresentationObject(resultsValue as any, ih as any, parsed);
  };

  return (
    <div class="flex flex-1 overflow-hidden">
      {/* Left panel: controls */}
      <div class="flex w-80 flex-shrink-0 flex-col gap-4 overflow-auto border-r border-base-300 p-4">
        <Input
          label="Label"
          value={label()}
          onChange={setLabel}
          placeholder="Visualization label"
          fullWidth
        />

        <Show when={!p.poId}>
          <Select
            label="Metric"
            value={metricId() || undefined}
            options={p.metrics.filter((m) => !m.hide).map((m) => ({
              value: m.id,
              label: m.label + (m.variantLabel ? ` — ${m.variantLabel}` : ""),
            }))}
            onChange={setMetricId}
            placeholder="Select metric..."
            fullWidth
          />
        </Show>

        <Show when={p.poId && selectedMetric()}>
          <div class="text-xs text-base-content/50">
            Metric: {selectedMetric()!.label}
            {selectedMetric()!.variantLabel ? ` — ${selectedMetric()!.variantLabel}` : ""}
          </div>
        </Show>

        <Show when={parsedConfig()}>
          <Select
            label="Chart type"
            value={parsedConfig()!.d.type}
            options={presentationTypeOptions()}
            onChange={handleTypeChange}
            fullWidth
          />

          <Show when={availableDisaggOptions().length > 0}>
            <div class="flex flex-col gap-2">
              <div class="ui-label">Disaggregate by</div>
              <For each={availableDisaggOptions()}>
                {(disOpt) => (
                  <Checkbox
                    label={disOpt.replace(/_/g, " ")}
                    checked={activeDisaggOptions().has(disOpt)}
                    onChange={(checked) => handleDisaggToggle(disOpt, checked)}
                  />
                )}
              </For>
            </div>
          </Show>

          <div class="flex flex-col gap-1">
            <TextArea
              label="Config (JSON)"
              value={rawConfigText()}
              onChange={setRawConfigText}
              rows={10}
              mono
              fullWidth
            />
            <Button intent="neutral" size="sm" onClick={handleApplyConfig}>
              Apply config
            </Button>
          </div>
        </Show>

        <div class="flex flex-col gap-2 pt-2">
          <Button
            intent="primary"
            size="sm"
            state={{ status: saveLoading() ? "loading" : "ready" }}
            onClick={handleSave}
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
            >
              Delete
            </Button>
          </Show>
        </div>
      </div>

      {/* Right panel: chart preview */}
      <div class="flex flex-1 flex-col overflow-auto p-4">
        <div class="text-xs font-600 text-base-content/60 uppercase tracking-wider mb-3">Preview</div>
        <Show
          when={figureInputs()}
          fallback={
            <Switch>
              <Match when={itemsQuery.state().status === "loading"}>
                <div class="text-sm text-base-content/40">Loading data...</div>
              </Match>
              <Match when={!metricId()}>
                <div class="text-sm text-base-content/40">Select a metric to preview</div>
              </Match>
              <Match when={!config()}>
                <div class="text-sm text-base-content/40">Configure the visualization to preview</div>
              </Match>
              <Match when={true}>
                <div class="text-sm text-base-content/40">No data available</div>
              </Match>
            </Switch>
          }
        >
          {(fi) => (
            <Show
              when={fi().status === "ready"}
              fallback={<div class="text-sm text-base-content/40">{fi().status === "error" ? (fi() as any).err : "No preview"}</div>}
            >
              <ChartHolder chartInputs={(fi() as any).data} height={500} />
            </Show>
          )}
        </Show>
      </div>
    </div>
  );
}
