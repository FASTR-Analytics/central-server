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
import { For, Show, createMemo, createSignal } from "solid-js";
import {
  type DisaggregationOption,
  type PresentationObjectConfig,
  type PresentationOption,
  get_PRESENTATION_SELECT_OPTIONS,
  getDisaggregationLabel,
  getStartingConfigForPresentationObject,
  isDisaggregationOption,
} from "platform-lib";
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
  const [selectedType, setSelectedType] = createSignal<PresentationOption | undefined>(undefined);
  const [selectedDisaggregations, setSelectedDisaggregations] = createSignal<
    DisaggregationOption[]
  >([]);

  const metricsByModule = createMemo(() => groupMetrics(p.metrics));

  const selectedMetric = createMemo(
    () => p.metrics.find((m) => m.id === selectedMetricId()) ?? null,
  );

  const stepperData = createMemo(() => ({
    hasMetric: !!selectedMetricId(),
    hasType: !!selectedType(),
  }));

  const stepper = getStepper(stepperData, {
    initialStep: 0,
    minStep: 0,
    maxStep: 1,
    getValidation: (step, data) => {
      if (step === 0) return { canGoPrev: false, canGoNext: data.hasMetric };
      if (step === 1) return { canGoPrev: true, canGoNext: data.hasType };
      return { canGoPrev: true, canGoNext: false };
    },
  });

  const stepLabels = ["Metric", "Configure"];

  const handleMetricSelect = (metricId: string) => {
    if (metricId !== selectedMetricId()) {
      setSelectedMetricId(metricId);
      setSelectedType(undefined);
      setSelectedDisaggregations([]);
    }
  };

  const handleTypeSelect = (type: PresentationOption) => {
    setSelectedType(type);
    setSelectedDisaggregations([]);
  };

  const handleCreate = () => {
    const metric = selectedMetric();
    if (!metric) return;
    const type = selectedType();
    if (!type) return;

    const requiredSet = new Set(
      (JSON.parse(metric.requiredDisaggregationOptions ?? "[]") as string[]).filter(isDisaggregationOption),
    );
    const available = (JSON.parse(metric.availableDisaggregationOptions ?? "[]") as string[]).filter(
      isDisaggregationOption,
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

    const fakeRv = {
      id: metric.id,
      resultsObjectId: metric.resultsObjectId,
      valueProps: JSON.parse(metric.valueProps ?? "[]"),
      valueFunc: metric.valueFunc,
      label: metric.label,
      formatAs: metric.formatAs,
      disaggregationOptions: allDisOpts,
      mostGranularTimePeriodColumnInResultsFile: mostGranular,
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
          <StepperChipsWithTitles stepper={stepper} labels={stepLabels} />
        </div>
      }
      leftButtons={
        <Show when={stepper.currentStep() > 0}>
          <Button onClick={stepper.goPrev} outline>
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
            when={stepper.currentStep() === 1}
            fallback={
              <Button onClick={stepper.goNext} disabled={!stepper.canGoNext()}>
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
      <div class="h-[min(36rem,60vh)]">
        <Show when={stepper.currentStep() === 0}>
          <_Step1Metric
            metricsByModule={metricsByModule()}
            allMetricCount={p.metrics.filter((m) => !m.hide).length}
            selectedMetricId={selectedMetricId()}
            onSelectMetric={handleMetricSelect}
          />
        </Show>
        <Show when={stepper.currentStep() === 1}>
          <_Step2Configure
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
        </Show>
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

  type SidebarOption = { value: string | "all"; label: string; count: number };

  const sidebarOptions = createMemo((): SidebarOption[] => {
    const all: SidebarOption = { value: "all", label: "All modules", count: p.allMetricCount };
    const moduleOpts: SidebarOption[] = p.metricsByModule.map((mod) => ({
      value: mod.moduleId,
      label: mod.moduleId,
      count: mod.metricGroups.reduce((s, g) => s + g.variants.length, 0),
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
              options={sidebarOptions()}
              value={selectedModule()}
              onChange={setSelectedModule}
              fullWidth
              renderOption={(opt) => (
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate">{(opt as SidebarOption).label}</span>
                  <span class="text-base-content/40 shrink-0 text-xs">
                    {(opt as SidebarOption).count}
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

type Step2Props = {
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

function _Step2Configure(p: Step2Props) {
  const disOpts = createMemo(() => {
    if (!p.metric) return [];
    const requiredSet = new Set(
      (JSON.parse(p.metric.requiredDisaggregationOptions ?? "[]") as string[]).filter(isDisaggregationOption),
    );
    const available = (JSON.parse(p.metric.availableDisaggregationOptions ?? "[]") as string[]).filter(
      isDisaggregationOption,
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

      <Show when={p.selectedType && availableDisaggregations().length > 0}>
        <div>
          <div class="font-700 mb-3">Disaggregate by</div>
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
        </div>
      </Show>
    </div>
  );
}
