import {
  AlertComponentProps,
  Button,
  Checkbox,
  FrameLeft,
  ModalContainer,
  SelectList,
  StepperChipsWithTitles,
  getStepper,
} from "panther";
import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";
import {
  DEFAULT_S_CONFIG,
  DEFAULT_T_CONFIG,
  type DisaggregationOption,
  type PresentationObjectConfig,
  type PresentationOption,
  type VizPreset,
  get_PRESENTATION_SELECT_OPTIONS,
  getDisaggregationLabel,
  getStartingConfigForPresentationObject,
} from "platform-lib";
import { isCentralDisaggregationOption } from "~/disaggregation_helpers";
import { type ProjectMetric } from "~/server_actions";

export type AddVisualizationResult = {
  metric: ProjectMetric;
  config: PresentationObjectConfig;
};

export type AddVisualizationModalProps = {
  metrics: ProjectMetric[];
};

type MetricGroup = {
  label: string;
  variants: ProjectMetric[];
};

type MetricsByModule = {
  moduleId: string;
  metricGroups: MetricGroup[];
};

const CUSTOM_OPTION = "__custom__";

function groupMetrics(metrics: ProjectMetric[]): MetricsByModule[] {
  const visibleMetrics = metrics.filter((m) => !m.hide);
  const moduleMap = new Map<string, ProjectMetric[]>();
  for (const metric of visibleMetrics) {
    if (!moduleMap.has(metric.moduleId)) {
      moduleMap.set(metric.moduleId, []);
    }
    moduleMap.get(metric.moduleId)!.push(metric);
  }

  const result: MetricsByModule[] = [];
  for (const [moduleId, moduleMetrics] of moduleMap) {
    const labelMap = new Map<string, ProjectMetric[]>();
    for (const m of moduleMetrics) {
      if (!labelMap.has(m.label)) {
        labelMap.set(m.label, []);
      }
      labelMap.get(m.label)!.push(m);
    }
    const metricGroups: MetricGroup[] = Array.from(labelMap.entries()).map(
      ([label, variants]) => ({ label, variants }),
    );
    result.push({ moduleId, metricGroups });
  }
  return result;
}

export function AddVisualizationModal(
  p: AlertComponentProps<AddVisualizationModalProps, AddVisualizationResult>,
) {
  const [selectedMetricId, setSelectedMetricId] = createSignal("");
  const [selectedPresetId, setSelectedPresetId] = createSignal<string | undefined>(undefined);
  const [selectedType, setSelectedType] = createSignal<PresentationOption | undefined>(undefined);
  const [selectedDisaggregations, setSelectedDisaggregations] = createSignal<
    DisaggregationOption[]
  >([]);

  const metricsByModule = createMemo(() => groupMetrics(p.metrics));

  const selectedMetric = createMemo(
    () => p.metrics.find((m) => m.id === selectedMetricId()) ?? null,
  );

  const parsedPresets = createMemo((): VizPreset[] => {
    const metric = selectedMetric();
    if (!metric?.vizPresets) return [];
    try {
      return JSON.parse(metric.vizPresets) as VizPreset[];
    } catch {
      return [];
    }
  });

  const metricHasPresets = createMemo(() => parsedPresets().length > 0);

  const isPresetSelected = () => {
    const id = selectedPresetId();
    return !!id && id !== CUSTOM_OPTION;
  };

  const stepperData = createMemo(() => ({
    hasMetric: !!selectedMetricId(),
    hasPreset: !!selectedPresetId(),
    hasType: !!selectedType(),
  }));

  const stepper = getStepper(stepperData, {
    initialStep: 0,
    minStep: 0,
    maxStep: 2,
    getValidation: (step, data) => {
      if (step === 0) return { canGoPrev: false, canGoNext: data.hasMetric };
      if (step === 1) return { canGoPrev: true, canGoNext: metricHasPresets() ? data.hasPreset : data.hasType };
      if (step === 2) return { canGoPrev: true, canGoNext: data.hasType };
      return { canGoPrev: true, canGoNext: false };
    },
  });

  const stepLabels = ["Metric", "Presets", "Configure"];

  const visibleSteps = createMemo(() => {
    if (!metricHasPresets()) return [0, 2];
    if (isPresetSelected()) return [0, 1];
    return [0, 1, 2];
  });

  const isLastStep = () =>
    stepper.currentStep() === 2 ||
    (stepper.currentStep() === 1 && (isPresetSelected() || !metricHasPresets()));

  const handleMetricSelect = (metricId: string) => {
    if (metricId !== selectedMetricId()) {
      setSelectedMetricId(metricId);
      setSelectedPresetId(undefined);
      setSelectedType(undefined);
      setSelectedDisaggregations([]);
    }
  };

  const handlePresetSelect = (presetId: string) => {
    setSelectedPresetId(presetId);
    setSelectedType(undefined);
    setSelectedDisaggregations([]);
  };

  const handleTypeSelect = (type: PresentationOption) => {
    setSelectedType(type);
    setSelectedDisaggregations([]);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isLastStep() && stepper.canGoNext()) {
        handleCreate();
      } else if (!isLastStep() && stepper.canGoNext()) {
        handleNext();
      }
    }
  };

  const handleNext = () => {
    if (!metricHasPresets() && stepper.currentStep() === 0) {
      // Skip the preset step entirely
      stepper.goNext();
      stepper.goNext();
    } else {
      stepper.goNext();
    }
  };

  const handleBack = () => {
    if (!metricHasPresets() && stepper.currentStep() === 2) {
      stepper.goPrev();
      stepper.goPrev();
    } else {
      stepper.goPrev();
    }
  };

  const handleCreate = () => {
    const metric = selectedMetric();
    if (!metric) return;

    const presetId = selectedPresetId();
    if (presetId && presetId !== CUSTOM_OPTION) {
      const preset = parsedPresets().find((pr) => pr.id === presetId);
      if (!preset) return;
      const config: PresentationObjectConfig = {
        d: preset.config.d,
        s: { ...DEFAULT_S_CONFIG, ...preset.config.s },
        t: {
          ...DEFAULT_T_CONFIG,
          caption: preset.config.t.caption ? preset.config.t.caption.en : DEFAULT_T_CONFIG.caption,
          subCaption: preset.config.t.subCaption ? preset.config.t.subCaption.en : DEFAULT_T_CONFIG.subCaption,
          footnote: preset.config.t.footnote ? preset.config.t.footnote.en : DEFAULT_T_CONFIG.footnote,
          captionRelFontSize: preset.config.t.captionRelFontSize ?? DEFAULT_T_CONFIG.captionRelFontSize,
          subCaptionRelFontSize: preset.config.t.subCaptionRelFontSize ?? DEFAULT_T_CONFIG.subCaptionRelFontSize,
          footnoteRelFontSize: preset.config.t.footnoteRelFontSize ?? DEFAULT_T_CONFIG.footnoteRelFontSize,
        },
      };
      p.close({ metric, config });
      return;
    }

    const type = selectedType();
    if (!type) return;

    const requiredSet = new Set(
      (JSON.parse(metric.requiredDisaggregationOptions ?? "[]") as string[]).filter(isCentralDisaggregationOption),
    );
    const available = (JSON.parse(metric.availableDisaggregationOptions ?? "[]") as string[]).filter(
      isCentralDisaggregationOption,
    );
    const allValues = [...new Set([...requiredSet, ...available])];
    const allDisOpts = allValues.map((d) => ({ value: d, isRequired: requiredSet.has(d) }));

    const periodCols = ["period_id", "quarter_id", "year"] as const;
    const mostGranular = allDisOpts.find((d) =>
      (periodCols as readonly string[]).includes(d.value),
    )?.value as (typeof periodCols)[number] | undefined;

    const disaggregations = allDisOpts
      .filter((d) => d.isRequired || selectedDisaggregations().includes(d.value))
      .map((d) => d.value);

    const parsedPostAggExpr = (() => {
      try {
        return metric.postAggregationExpression ? JSON.parse(metric.postAggregationExpression) : undefined;
      } catch { return undefined; }
    })();

    const fakeRv = {
      id: metric.id,
      resultsObjectId: metric.resultsObjectId,
      valueProps: JSON.parse(metric.valueProps ?? "[]"),
      valueFunc: metric.valueFunc,
      label: metric.label,
      formatAs: metric.formatAs,
      disaggregationOptions: allDisOpts,
      mostGranularTimePeriodColumnInResultsFile: mostGranular,
      postAggregationExpression: parsedPostAggExpr,
    };

    const config = getStartingConfigForPresentationObject(fakeRv as any, type, disaggregations);

    p.close({
      metric,
      config,
    });
  };

  return (
    <ModalContainer
      width="xl"
      noContentPadding
      topPanel={
        <div class="flex items-center justify-between">
          <div class="font-700 text-lg">Create visualization</div>
          <StepperChipsWithTitles stepper={stepper} labels={stepLabels} visibleSteps={visibleSteps()} />
        </div>
      }
      leftButtons={
        <Show when={stepper.currentStep() > 0}>
          <Button onClick={handleBack} outline>
            Back
          </Button>
        </Show>
      }
      rightButtons={
        <>
          <Button onClick={() => p.close(undefined)} outline>
            Cancel
          </Button>
          <Show
            when={isLastStep()}
            fallback={
              <Button onClick={handleNext} disabled={!stepper.canGoNext()}>
                Next
              </Button>
            }
          >
            <Button onClick={handleCreate} disabled={!stepper.canGoNext()}>
              Create
            </Button>
          </Show>
        </>
      }
    >
      <div class="h-[min(36rem,60vh)]" onKeyDown={handleKeyDown} tabIndex={0}>
        <Switch>
          <Match when={stepper.currentStep() === 0}>
            <_Step1Metric
              metricsByModule={metricsByModule()}
              allMetricCount={p.metrics.filter((m) => !m.hide).length}
              selectedMetricId={selectedMetricId()}
              onSelectMetric={handleMetricSelect}
            />
          </Match>
          <Match when={stepper.currentStep() === 1 && metricHasPresets()}>
            <_Step2Preset
              presets={parsedPresets()}
              selectedPresetId={selectedPresetId()}
              onSelectPreset={handlePresetSelect}
            />
          </Match>
          <Match when={stepper.currentStep() === 2 || (stepper.currentStep() === 1 && !metricHasPresets())}>
            <_Step3Configure
              metric={selectedMetric()!}
              selectedType={selectedType()}
              selectedDisaggregations={selectedDisaggregations()}
              onSelectType={handleTypeSelect}
              onToggleDisaggregation={(d, checked) => {
                setSelectedDisaggregations((prev) =>
                  checked ? [...prev, d] : prev.filter((x) => x !== d),
                );
              }}
            />
          </Match>
        </Switch>
      </div>
    </ModalContainer>
  );
}

///////////////////////////////////////////////////////////////////////////////

type Step1Props = {
  metricsByModule: MetricsByModule[];
  allMetricCount: number;
  selectedMetricId: string;
  onSelectMetric: (id: string) => void;
};

function _Step1Metric(p: Step1Props) {
  const [selectedModule, setSelectedModule] = createSignal<string | "all">("all");

  type SidebarMeta = { count: number };

  const sidebarOptions = createMemo(() => {
    const all = { id: "all" as string, label: "All modules", meta: { count: p.allMetricCount } };
    const moduleOpts = p.metricsByModule.map((mod) => ({
      id: mod.moduleId,
      label: mod.moduleId,
      meta: { count: mod.metricGroups.reduce((s, g) => s + g.variants.length, 0) },
    }));
    return [all, ...moduleOpts];
  });

  const filteredGroups = createMemo((): MetricGroup[] => {
    const mod = selectedModule();
    if (mod === "all") {
      return p.metricsByModule.flatMap((m) => m.metricGroups);
    }
    return p.metricsByModule.find((m) => m.moduleId === mod)?.metricGroups ?? [];
  });

  return (
    <div class="h-full">
      <FrameLeft
        panelChildren={
          <div class="border-base-300 ui-pad h-full w-56 border-r">
            <SelectList
              items={sidebarOptions()}
              value={selectedModule()}
              onChange={setSelectedModule}
              fullWidth
              renderItem={(item) => (
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate">{item.label as string}</span>
                  <span class="text-base-content/40 shrink-0 text-xs">
                    {(item.meta as SidebarMeta | undefined)?.count}
                  </span>
                </div>
              )}
            />
          </div>
        }
      >
        <div class="ui-pad overflow-auto">
          <Show
            when={filteredGroups().length > 0}
            fallback={
              <div class="text-base-content/40 py-8 text-center text-sm">
                No metrics available
              </div>
            }
          >
            <div class="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">
              <For each={filteredGroups()}>
                {(group) => (
                  <_MetricCard
                    group={group}
                    selectedMetricId={p.selectedMetricId}
                    onSelect={p.onSelectMetric}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </FrameLeft>
    </div>
  );
}

type MetricCardProps = {
  group: MetricGroup;
  selectedMetricId: string;
  onSelect: (id: string) => void;
};

function _MetricCard(p: MetricCardProps) {
  const hasVariants = () => p.group.variants.length > 1;
  const firstMetric = () => p.group.variants[0];
  const isGroupSelected = () => p.group.variants.some((v) => v.id === p.selectedMetricId);

  return (
    <div
      class="ui-pad border-base-300 rounded border transition-colors"
      classList={{
        "bg-primary/5 border-primary": isGroupSelected(),
        "bg-base-100": !isGroupSelected(),
        "ui-hoverable cursor-pointer": !hasVariants(),
      }}
      onClick={() => {
        if (!hasVariants()) p.onSelect(firstMetric().id);
      }}
    >
      <div class="ui-spy-sm">
        <div class="font-700">{p.group.label}</div>

        <Show when={hasVariants()}>
          <div class="border-base-300 border-t pt-2">
            <div class="text-base-content/40 mb-1 text-xs">Select variant:</div>
            <div class="flex flex-wrap gap-1">
              <For each={p.group.variants}>
                {(variant) => (
                  <div
                    class="cursor-pointer rounded px-2 py-1 text-sm transition-colors"
                    classList={{
                      "bg-primary/10 font-700": p.selectedMetricId === variant.id,
                      "bg-base-200 ui-hoverable": p.selectedMetricId !== variant.id,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onSelect(variant.id);
                    }}
                  >
                    {variant.variantLabel ?? "Default"}
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

///////////////////////////////////////////////////////////////////////////////

type Step2PresetProps = {
  presets: VizPreset[];
  selectedPresetId: string | undefined;
  onSelectPreset: (id: string) => void;
};

function _Step2Preset(p: Step2PresetProps) {
  return (
    <div class="ui-pad h-full overflow-auto">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
        <For each={p.presets}>
          {(preset) => (
            <_PresetCard
              id={preset.id}
              label={preset.label.en}
              description={preset.description.en}
              selected={p.selectedPresetId === preset.id}
              onClick={() => p.onSelectPreset(preset.id)}
            />
          )}
        </For>
        <_PresetCard
          id={CUSTOM_OPTION}
          label="Custom"
          description="Configure manually"
          selected={p.selectedPresetId === CUSTOM_OPTION}
          onClick={() => p.onSelectPreset(CUSTOM_OPTION)}
        />
      </div>
    </div>
  );
}

type PresetCardProps = {
  id: string;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
};

function _PresetCard(p: PresetCardProps) {
  return (
    <div
      class="bg-base-100 ui-pad border-base-300 cursor-pointer rounded border transition-colors"
      classList={{
        "border-primary bg-primary/5": p.selected,
        "ui-hoverable": !p.selected,
      }}
      onClick={p.onClick}
    >
      <div class="font-700 text-sm">{p.label}</div>
      <div class="text-base-content/50 mt-1 text-xs">{p.description}</div>
    </div>
  );
}

///////////////////////////////////////////////////////////////////////////////

type Step3Props = {
  metric: ProjectMetric | null;
  selectedType: PresentationOption | undefined;
  selectedDisaggregations: DisaggregationOption[];
  onSelectType: (type: PresentationOption) => void;
  onToggleDisaggregation: (d: DisaggregationOption, checked: boolean) => void;
};

const ALL_TYPES: PresentationOption[] = ["table", "timeseries", "chart", "map"];
const TYPE_LABELS: Record<PresentationOption, string> = {
  table: "Table",
  timeseries: "Time series",
  chart: "Bar chart",
  map: "Map",
};

function _Step3Configure(p: Step3Props) {
  const disOpts = createMemo(() => {
    if (!p.metric) return [];
    const requiredSet = new Set(
      (JSON.parse(p.metric.requiredDisaggregationOptions ?? "[]") as string[]).filter(isCentralDisaggregationOption),
    );
    const available = (JSON.parse(p.metric.availableDisaggregationOptions ?? "[]") as string[]).filter(
      isCentralDisaggregationOption,
    );
    const allValues = [...new Set([...requiredSet, ...available])];
    return allValues.map((d) => ({ value: d, isRequired: requiredSet.has(d) }));
  });

  const typeOptions = createMemo(() => get_PRESENTATION_SELECT_OPTIONS(disOpts()));

  const availableDisaggregations = createMemo(() => {
    const type = p.selectedType;
    if (!type) return [];
    return disOpts();
  });

  const getDisabledReason = (type: PresentationOption): string | undefined => {
    if (typeOptions().some((o) => o.value === type)) return undefined;
    if (type === "timeseries") return "Requires period disaggregation";
    if (type === "map") return "Requires area disaggregation";
    return "Not available for this metric";
  };

  return (
    <div class="ui-pad ui-spy overflow-auto">
      <div>
        <div class="font-700 mb-3">Visualization type</div>
        <div class="ui-gap-sm grid grid-cols-4">
          <For each={ALL_TYPES}>
            {(type) => {
              const isDisabled = () => !typeOptions().some((o) => o.value === type);
              return (
                <button
                  type="button"
                  class="ui-pad border-base-300 flex w-full items-center justify-center rounded border transition-colors"
                  classList={{
                    "bg-primary/10 border-primary font-700": p.selectedType === type,
                    "bg-base-100 ui-hoverable": !isDisabled() && p.selectedType !== type,
                    "bg-base-200 opacity-50 cursor-not-allowed": isDisabled(),
                  }}
                  disabled={isDisabled()}
                  title={isDisabled() ? getDisabledReason(type) : undefined}
                  onClick={() => {
                    if (!isDisabled()) p.onSelectType(type);
                  }}
                >
                  {TYPE_LABELS[type]}
                </button>
              );
            }}
          </For>
        </div>
      </div>

      <Show when={p.selectedType}>
        <div>
          <div class="font-700 mb-3">Disaggregate by</div>
          <Show
            when={availableDisaggregations().length > 0}
            fallback={
              <div class="text-base-content/50 text-sm">
                No disaggregation options available for this visualization type
              </div>
            }
          >
            <div class="ui-spy-sm">
              <For each={availableDisaggregations()}>
                {(disOpt) => (
                  <Checkbox
                    label={
                      <>
                        {getDisaggregationLabel(disOpt.value, {}).en}
                        <Show when={disOpt.isRequired}>
                          <span class="text-base-content/40 ml-2 text-xs">(required)</span>
                        </Show>
                      </>
                    }
                    checked={disOpt.isRequired || p.selectedDisaggregations.includes(disOpt.value)}
                    disabled={disOpt.isRequired}
                    onChange={(checked) => {
                      if (!disOpt.isRequired) {
                        p.onToggleDisaggregation(disOpt.value, checked);
                      }
                    }}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
