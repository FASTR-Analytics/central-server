import {
  type BoundedPeriodFilter,
  type DisaggregationPossibleValuesStatus,
  PeriodBounds,
  periodFilterHasBounds,
  PresentationObjectConfig,
  PresentationObjectDetail,
  ResultsValue,
  getCalendar,
  getDisaggregationLabel,
  type ResultsValueInfoForPresentationObject,
  type DisaggregationOption,
} from "platform-lib";
import {
  Button,
  Checkbox,
  DoubleSlider,
  RadioGroup,
  Slider,
  formatPeriod,
  getPeriodIdFromTime,
  getTimeFromPeriodId,
} from "panther";
import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";
import { SetStoreFunction } from "solid-js/store";

function getDisplayDisaggregationLabel(disOpt: DisaggregationOption): string {
  if ((disOpt as string) === "admin_area_1") return "Country";
  return getDisaggregationLabel(disOpt, {}).en;
}

function periodIdToQuarterId(periodId: number): number {
  const year = Math.floor(periodId / 100);
  const month = periodId % 100;
  const calendar = getCalendar();
  if (calendar === "ethiopian") {
    if (month >= 11) return (year + 1) * 100 + 1;
    if (month <= 1) return year * 100 + 1;
    if (month <= 4) return year * 100 + 2;
    if (month <= 7) return year * 100 + 3;
    return year * 100 + 4;
  }
  return year * 100 + Math.ceil(month / 3);
}

function reconcilePeriodFilterWithBounds(
  periodFilter: BoundedPeriodFilter,
  periodBounds: PeriodBounds,
): BoundedPeriodFilter {
  if (periodFilter.periodOption === periodBounds.periodOption) return periodFilter;
  const target = periodBounds.periodOption;
  const convert = (v: number, isEnd: boolean): number => {
    const digits = String(v).length;
    if (digits <= 4) {
      if (target === "year") return v;
      if (target === "quarter_id") return v * 100 + (isEnd ? 4 : 1);
      if (target === "period_id") return v * 100 + (isEnd ? 12 : 1);
    }
    const year = Math.floor(v / 100);
    const sub = v % 100;
    if (target === "year") return year;
    if (target === "period_id") return v;
    if (target === "quarter_id" && sub >= 1 && sub <= 12) return periodIdToQuarterId(v);
    return v;
  };
  return {
    ...periodFilter,
    periodOption: target,
    min: convert(periodFilter.min, false),
    max: convert(periodFilter.max, true),
  };
}

type FiltersProps = {
  poDetail: PresentationObjectDetail;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
  resultsValueInfo: ResultsValueInfoForPresentationObject;
  allowedFilterOptions: ResultsValue["disaggregationOptions"];
};

export function Filters(p: FiltersProps) {
  const excludedFilters = !!p.resultsValueInfo.periodBounds
    ? ["year", "period_id", "quarter_id", "month"]
    : ["period_id", "quarter_id", "month"];
  const filterOptionsExcludingPeriods = () =>
    p.allowedFilterOptions.filter((opt) => !excludedFilters.includes(opt.value));

  return (
    <div class="ui-spy-sm">
      <div class="text-md font-700">Filter (subset)</div>

      <div class="ui-spy-sm">
        <Show when={p.poDetail.resultsValue.valueProps.length > 1}>
          <DataValuesFilter
            poDetail={p.poDetail}
            tempConfig={p.tempConfig}
            setTempConfig={p.setTempConfig}
          />
        </Show>

        <Show when={p.resultsValueInfo.periodBounds} keyed>
          {(keyedPeriodBounds) => (
            <PeriodFilter
              tempConfig={p.tempConfig}
              setTempConfig={p.setTempConfig}
              keyedPeriodBounds={keyedPeriodBounds}
              resultsValueInfo={p.resultsValueInfo}
            />
          )}
        </Show>

        <For each={filterOptionsExcludingPeriods()}>
          {(disOpt) => {
            const status = () => p.resultsValueInfo.disaggregationPossibleValues[disOpt.value];
            return (
              <Show when={status()} keyed>
                {(keyedStatus) => (
                  <DisaggregationFilter
                    disOpt={disOpt}
                    keyedStatus={keyedStatus}
                    tempConfig={p.tempConfig}
                    setTempConfig={p.setTempConfig}
                  />
                )}
              </Show>
            );
          }}
        </For>
      </div>
    </div>
  );
}

type DataValuesFilterProps = {
  poDetail: PresentationObjectDetail;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
};

function DataValuesFilter(p: DataValuesFilterProps) {
  return (
    <div class="ui-spy-sm">
      <Checkbox
        label="Data values"
        checked={!!p.tempConfig.d.valuesFilter}
        onChange={(checked) => {
          if (checked) {
            p.setTempConfig("d", "valuesFilter", []);
          } else {
            p.setTempConfig("d", "valuesFilter", undefined);
          }
        }}
      />
      <Show when={p.tempConfig.d.valuesFilter} keyed>
        {(keyedValuesFilter) => {
          function toggleVal(val: string) {
            p.setTempConfig("d", "valuesFilter", (prev) => {
              if (prev?.includes(val)) return prev.filter((v) => v !== val);
              return [...(prev ?? []), val];
            });
          }
          return (
            <div class="pb-4">
              <div class="ui-gap-sm ui-pad border-base-300 flex max-h-[300px] flex-wrap overflow-auto rounded border font-mono text-xs">
                <For each={p.poDetail.resultsValue.valueProps}>
                  {(opt) => (
                    <div
                      class="ui-hoverable bg-base-200 data-[selected=true]:bg-success data-[selected=true]:text-base-100 rounded px-2 py-1"
                      onClick={() => toggleVal(opt)}
                      data-selected={keyedValuesFilter.includes(opt)}
                    >
                      <span class="relative">{opt}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          );
        }}
      </Show>
    </div>
  );
}

type PeriodFilterProps = {
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
  keyedPeriodBounds: PeriodBounds;
  resultsValueInfo: ResultsValueInfoForPresentationObject;
};

function PeriodFilter(p: PeriodFilterProps) {
  return (
    <div class="ui-spy-sm">
      <Checkbox
        label="Time period"
        checked={!!p.tempConfig.d.periodFilter}
        onChange={(checked) => {
          if (checked) {
            if (p.keyedPeriodBounds.periodOption === "quarter_id") {
              p.setTempConfig("d", "periodFilter", { filterType: "last_n_calendar_quarters", nQuarters: 4 });
            } else {
              p.setTempConfig("d", "periodFilter", { filterType: "last_n_months", nMonths: 12 });
            }
          } else {
            p.setTempConfig("d", "periodFilter", undefined);
          }
        }}
      />
      <Show when={p.tempConfig.d.periodFilter} keyed>
        {(rawPeriodFilter) => {
          const displayFilterType = () => {
            const ft = p.tempConfig.d.periodFilter?.filterType;
            if (ft === "last_calendar_year") return "last_n_calendar_years";
            if (ft === "last_calendar_quarter") return "last_n_calendar_quarters";
            return ft;
          };
          const periodOption = p.keyedPeriodBounds.periodOption;
          const boundedFilter = createMemo(() => {
            const pBounds = p.keyedPeriodBounds;
            return periodFilterHasBounds(rawPeriodFilter)
              ? reconcilePeriodFilterWithBounds(rawPeriodFilter, pBounds)
              : undefined;
          });
          return (
            <div class="ui-spy-sm pb-4 pl-4">
              <RadioGroup
                value={displayFilterType()}
                options={
                  periodOption === "year"
                    ? [
                        { value: "last_n_months", label: "Last year" },
                        { value: "custom", label: "Custom" },
                      ]
                    : periodOption === "quarter_id"
                    ? [
                        { value: "last_n_calendar_quarters", label: "Last N calendar quarters" },
                        { value: "from_month", label: "From specific quarter" },
                        { value: "custom", label: "Custom" },
                      ]
                    : [
                        { value: "last_n_months", label: "Last N months" },
                        { value: "from_month", label: "From specific month to present" },
                        { value: "last_n_calendar_years", label: "Last N full calendar years" },
                        { value: "last_n_calendar_quarters", label: "Last N full calendar quarters" },
                        { value: "custom", label: "Custom" },
                      ]
                }
                onChange={(v) => {
                  const newType = v as NonNullable<PresentationObjectConfig["d"]["periodFilter"]>["filterType"];
                  if (newType === "custom" || newType === "from_month") {
                    p.setTempConfig("d", "periodFilter", {
                      filterType: newType,
                      periodOption: p.keyedPeriodBounds.periodOption,
                      min: p.keyedPeriodBounds.min,
                      max: p.keyedPeriodBounds.max,
                    });
                  } else if (newType === "last_n_months") {
                    p.setTempConfig("d", "periodFilter", { filterType: newType, nMonths: 12 });
                  } else if (newType === "last_n_calendar_years") {
                    p.setTempConfig("d", "periodFilter", { filterType: newType, nYears: 1 });
                  } else if (newType === "last_n_calendar_quarters") {
                    p.setTempConfig("d", "periodFilter", { filterType: newType, nQuarters: 4 });
                  } else {
                    p.setTempConfig("d", "periodFilter", { filterType: newType });
                  }
                }}
              />
              <Show when={rawPeriodFilter.filterType === "last_n_months" && periodOption === "period_id"}>
                <NMonthsSelector
                  nMonths={rawPeriodFilter.filterType === "last_n_months" ? rawPeriodFilter.nMonths : undefined}
                  onUpdate={(nMonths) =>
                    p.setTempConfig("d", "periodFilter", { filterType: "last_n_months", nMonths })
                  }
                />
              </Show>
              <Show when={rawPeriodFilter.filterType === "last_n_calendar_years" || rawPeriodFilter.filterType === "last_calendar_year"}>
                <NYearsSelector
                  nYears={rawPeriodFilter.filterType === "last_n_calendar_years" ? rawPeriodFilter.nYears : undefined}
                  onUpdate={(nYears) => {
                    p.setTempConfig("d", "periodFilter", { filterType: "last_n_calendar_years", nYears });
                  }}
                />
              </Show>
              <Show when={rawPeriodFilter.filterType === "last_n_calendar_quarters" || rawPeriodFilter.filterType === "last_calendar_quarter"}>
                <NQuartersSelector
                  nQuarters={rawPeriodFilter.filterType === "last_n_calendar_quarters" ? rawPeriodFilter.nQuarters : undefined}
                  onUpdate={(nQuarters) => {
                    p.setTempConfig("d", "periodFilter", { filterType: "last_n_calendar_quarters", nQuarters });
                  }}
                />
              </Show>
              <Show when={rawPeriodFilter.filterType === "from_month" && boundedFilter()} keyed>
                {(bf) => (
                  <div class="ui-gap-sm ui-pad border-base-300 rounded border">
                    <PeriodFilterPeriodIdSingle
                      periodBounds={p.keyedPeriodBounds}
                      periodFilter={bf}
                      periodType={periodOption === "quarter_id" ? "year-quarter" : "year-month"}
                      onUpdate={(v) =>
                        p.setTempConfig("d", "periodFilter", {
                          periodOption: p.keyedPeriodBounds.periodOption,
                          filterType: "from_month",
                          min: v.minPeriodId,
                          max: p.keyedPeriodBounds.max,
                        })
                      }
                    />
                  </div>
                )}
              </Show>
              <Switch>
                <Match
                  when={
                    rawPeriodFilter.filterType === "custom" &&
                    (periodOption === "period_id" || periodOption === "quarter_id") &&
                    boundedFilter()
                  }
                  keyed
                >
                  {(bf) => (
                    <div class="ui-gap-sm ui-pad border-base-300 rounded border">
                      <PeriodFilterPeriodId
                        periodBounds={p.keyedPeriodBounds}
                        periodFilter={bf}
                        periodType={periodOption === "quarter_id" ? "year-quarter" : "year-month"}
                        onUpdate={(v) =>
                          p.setTempConfig("d", "periodFilter", {
                            filterType: "custom",
                            periodOption: p.keyedPeriodBounds.periodOption,
                            min: v.minPeriodId,
                            max: v.maxPeriodId,
                          })
                        }
                      />
                    </div>
                  )}
                </Match>
                <Match when={rawPeriodFilter.filterType === "custom" && boundedFilter()} keyed>
                  {(bf) => {
                    const toYear = (v: number) => String(v).length <= 4 ? v : Math.floor(v / 100);
                    return (
                      <PeriodFilterYear
                        periodBounds={{
                          periodOption: "year",
                          min: toYear(p.keyedPeriodBounds.min),
                          max: toYear(p.keyedPeriodBounds.max),
                        }}
                        periodFilter={{
                          ...bf,
                          periodOption: "year",
                          min: toYear(bf.min),
                          max: toYear(bf.max),
                        }}
                        onUpdate={(v) =>
                          p.setTempConfig("d", "periodFilter", {
                            filterType: "custom",
                            periodOption: bf.periodOption,
                            min: v.minYear,
                            max: v.maxYear,
                          })
                        }
                      />
                    );
                  }}
                </Match>
              </Switch>
            </div>
          );
        }}
      </Show>
    </div>
  );
}

type DisaggregationFilterProps = {
  disOpt: FiltersProps["allowedFilterOptions"][number];
  keyedStatus: DisaggregationPossibleValuesStatus;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
};

function DisaggregationFilter(p: DisaggregationFilterProps) {
  return (
    <div class="ui-spy-sm">
      <Checkbox
        label={getDisplayDisaggregationLabel(p.disOpt.value)}
        checked={!!p.tempConfig.d.filterBy.some((fil) => fil.disOpt === p.disOpt.value)}
        onChange={(checked) => {
          const isReplicantField = p.tempConfig.d.disaggregateBy.some(
            (d) => d.disDisplayOpt === "replicant" && d.disOpt === p.disOpt.value,
          );
          if (checked) {
            p.setTempConfig("d", "filterBy", (prev) => [
              ...prev.filter((d) => d.disOpt !== p.disOpt.value),
              { disOpt: p.disOpt.value, values: [] },
            ]);
            if (isReplicantField) p.setTempConfig("d", "selectedReplicantValue", undefined);
          } else {
            p.setTempConfig("d", "filterBy", (prev) =>
              prev.filter((d) => d.disOpt !== p.disOpt.value),
            );
            if (isReplicantField) p.setTempConfig("d", "selectedReplicantValue", undefined);
          }
        }}
      />
      <Show when={p.tempConfig.d.filterBy.find((fil) => fil.disOpt === p.disOpt.value)} keyed>
        {(keyedFilter) => {
          const isReplicantField = p.tempConfig.d.disaggregateBy.some(
            (d) => d.disDisplayOpt === "replicant" && d.disOpt === p.disOpt.value,
          );
          function toggleVal(val: string) {
            const normalized = String(val).toLowerCase();
            p.setTempConfig(
              "d",
              "filterBy",
              (fil) => fil.disOpt === p.disOpt.value,
              "values",
              (prev) => {
                if (prev?.some(v => String(v).toLowerCase() === normalized)) {
                  return prev.filter(v => String(v).toLowerCase() !== normalized);
                }
                return [...(prev ?? []), val];
              },
            );
            if (isReplicantField) p.setTempConfig("d", "selectedReplicantValue", undefined);
          }
          return (
            <div class="pb-4">
              <Switch>
                <Match when={p.keyedStatus.status === "too_many_values"}>
                  <div class="ui-pad text-sm text-warning">
                    Too many values (over 500) to display as filter options.
                  </div>
                </Match>
                <Match when={p.keyedStatus.status === "no_values_available"}>
                  <div class="ui-pad text-sm text-info">
                    No data available for this dimension.
                  </div>
                </Match>
                <Match when={p.keyedStatus.status === "error"}>
                  <div class="ui-pad text-sm text-danger">
                    Error loading values:{" "}
                    {(p.keyedStatus as Extract<DisaggregationPossibleValuesStatus, { status: "error" }>).message}
                  </div>
                </Match>
                <Match when={p.keyedStatus.status === "ok"}>
                  <div class="ui-gap-sm ui-pad border-base-300 flex max-h-[300px] flex-wrap overflow-auto rounded border font-mono text-xs">
                    <For each={(p.keyedStatus as Extract<DisaggregationPossibleValuesStatus, { status: "ok" }>).values}>
                      {(opt) => (
                        <div
                          class="ui-hoverable bg-base-200 data-[selected=true]:bg-success data-[selected=true]:text-base-100 rounded px-2 py-1"
                          onClick={() => toggleVal(opt.id)}
                          data-selected={keyedFilter.values.some(
                            v => String(v).toLowerCase() === String(opt.id).toLowerCase()
                          )}
                        >
                          <span class="relative">
                            {keyedFilter.disOpt === "indicator_common_id"
                              ? opt.id.toUpperCase()
                              : opt.label}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </Match>
              </Switch>
            </div>
          );
        }}
      </Show>
    </div>
  );
}

export type PeriodFilterPropsPeriodId = {
  periodBounds: PeriodBounds;
  periodFilter: PeriodBounds;
  periodType: "year-month" | "year-quarter";
  onUpdate: (v: { minPeriodId: number; maxPeriodId: number }) => void;
};

export function PeriodFilterPeriodId(p: PeriodFilterPropsPeriodId) {
  const [tempMinTime, setTempMinTime] = createSignal<number>(
    getTimeFromPeriodId(Math.max(p.periodFilter.min, p.periodBounds.min), p.periodType),
  );
  const [tempMaxTime, setTempMaxTime] = createSignal<number>(
    getTimeFromPeriodId(Math.min(p.periodFilter.max, p.periodBounds.max), p.periodType),
  );
  const [needsSave, setNeedsSave] = createSignal<boolean>(false);

  function save() {
    p.onUpdate({
      minPeriodId: getPeriodIdFromTime(tempMinTime(), p.periodType),
      maxPeriodId: getPeriodIdFromTime(tempMaxTime(), p.periodType),
    });
    setNeedsSave(false);
  }

  return (
    <div class="">
      <DoubleSlider
        min={getTimeFromPeriodId(p.periodBounds.min, p.periodType)}
        max={getTimeFromPeriodId(p.periodBounds.max, p.periodType)}
        increment={1}
        valueLow={tempMinTime()}
        valueHigh={tempMaxTime()}
        onChangeLow={(v) => { setTempMinTime(v); setNeedsSave(true); }}
        onChangeHigh={(v) => { setTempMaxTime(v); setNeedsSave(true); }}
      />
      <div class="ui-gap-sm flex pt-1 text-sm">
        <div class="flex-1 truncate">
          {formatPeriod(getPeriodIdFromTime(tempMinTime(), p.periodType), p.periodType, getCalendar())}
          {" to "}
          {formatPeriod(getPeriodIdFromTime(tempMaxTime(), p.periodType), p.periodType, getCalendar())}
        </div>
        <Show when={needsSave()}>
          <div class="">
            <Button onClick={save} intent="success">Update</Button>
          </div>
        </Show>
      </div>
    </div>
  );
}

export type PeriodFilterPropsPeriodIdSingle = {
  periodBounds: PeriodBounds;
  periodFilter: PeriodBounds;
  periodType: "year-month" | "year-quarter";
  onUpdate: (v: { minPeriodId: number; maxPeriodId: number }) => void;
};

export function PeriodFilterPeriodIdSingle(p: PeriodFilterPropsPeriodIdSingle) {
  const [tempTime, setTempTime] = createSignal<number>(
    getTimeFromPeriodId(Math.max(p.periodFilter.min, p.periodBounds.min), p.periodType),
  );
  const [needsSave, setNeedsSave] = createSignal<boolean>(false);

  function save() {
    p.onUpdate({
      minPeriodId: getPeriodIdFromTime(tempTime(), p.periodType),
      maxPeriodId: p.periodBounds.max,
    });
    setNeedsSave(false);
  }

  return (
    <div class="">
      <Slider
        value={tempTime()}
        onChange={(v) => { setTempTime(v); setNeedsSave(true); }}
        min={getTimeFromPeriodId(p.periodBounds.min, p.periodType)}
        max={getTimeFromPeriodId(p.periodBounds.max, p.periodType)}
        step={1}
        fullWidth
      />
      <div class="ui-gap-sm flex pt-1 text-sm">
        <div class="flex-1 truncate">
          From: {formatPeriod(getPeriodIdFromTime(tempTime(), p.periodType), p.periodType, getCalendar())}
        </div>
        <Show when={needsSave()}>
          <div class="">
            <Button onClick={save} intent="success">Update</Button>
          </div>
        </Show>
      </div>
    </div>
  );
}

export type NMonthsSelectorProps = {
  nMonths: number | undefined;
  label?: string;
  max?: number;
  onUpdate: (nMonths: number) => void;
};

export function NMonthsSelector(p: NMonthsSelectorProps) {
  const max = p.max ?? 24;
  const [tempNMonths, setTempNMonths] = createSignal<number>(p.nMonths ?? 12);
  const [needsSave, setNeedsSave] = createSignal<boolean>(false);

  function save() {
    p.onUpdate(tempNMonths());
    setNeedsSave(false);
  }

  return (
    <div class="ui-gap-sm ui-pad border-base-300 rounded border">
      <Slider
        label={p.label ?? "Number of months"}
        showValueInLabel
        valueInLabelFormatter={v => String(v)}
        value={tempNMonths()}
        onChange={(val) => {
          if (val >= 1 && val <= max) { setTempNMonths(val); setNeedsSave(true); }
        }}
        min={1}
        max={max}
        fullWidth
      />
      <Show when={needsSave()}>
        <div class="flex justify-end">
          <Button onClick={save} intent="success">Update</Button>
        </div>
      </Show>
    </div>
  );
}

export type NYearsSelectorProps = {
  nYears: number | undefined;
  onUpdate: (nYears: number) => void;
};

export function NYearsSelector(p: NYearsSelectorProps) {
  const [tempNYears, setTempNYears] = createSignal<number>(p.nYears ?? 1);
  const [needsSave, setNeedsSave] = createSignal<boolean>(false);

  function save() {
    p.onUpdate(tempNYears());
    setNeedsSave(false);
  }

  return (
    <div class="ui-gap-sm ui-pad border-base-300 rounded border">
      <Slider
        label="Number of years"
        showValueInLabel
        valueInLabelFormatter={v => String(v)}
        value={tempNYears()}
        onChange={(val) => {
          if (val >= 1 && val <= 10) { setTempNYears(val); setNeedsSave(true); }
        }}
        min={1}
        max={10}
        fullWidth
      />
      <Show when={needsSave()}>
        <div class="flex justify-end">
          <Button onClick={save} intent="success">Update</Button>
        </div>
      </Show>
    </div>
  );
}

export type NQuartersSelectorProps = {
  nQuarters: number | undefined;
  onUpdate: (nQuarters: number) => void;
};

export function NQuartersSelector(p: NQuartersSelectorProps) {
  const [tempNQuarters, setTempNQuarters] = createSignal<number>(p.nQuarters ?? 1);
  const [needsSave, setNeedsSave] = createSignal<boolean>(false);

  function save() {
    p.onUpdate(tempNQuarters());
    setNeedsSave(false);
  }

  return (
    <div class="ui-gap-sm ui-pad border-base-300 rounded border">
      <Slider
        label="Number of quarters"
        showValueInLabel
        valueInLabelFormatter={v => String(v)}
        value={tempNQuarters()}
        onChange={(val) => {
          if (val >= 1 && val <= 20) { setTempNQuarters(val); setNeedsSave(true); }
        }}
        min={1}
        max={20}
        fullWidth
      />
      <Show when={needsSave()}>
        <div class="flex justify-end">
          <Button onClick={save} intent="success">Update</Button>
        </div>
      </Show>
    </div>
  );
}

export type PeriodFilterPropsYear = {
  periodBounds: PeriodBounds;
  periodFilter: PeriodBounds;
  onUpdate: (v: { minYear: number; maxYear: number }) => void;
};

export function PeriodFilterYear(p: PeriodFilterPropsYear) {
  const [tempMinTime, setTempMinTime] = createSignal<number>(p.periodFilter.min);
  const [tempMaxTime, setTempMaxTime] = createSignal<number>(p.periodFilter.max);
  const [needsSave, setNeedsSave] = createSignal<boolean>(false);

  function save() {
    p.onUpdate({ minYear: tempMinTime(), maxYear: tempMaxTime() });
    setNeedsSave(false);
  }

  return (
    <div class="">
      <DoubleSlider
        min={p.periodBounds.min}
        max={p.periodBounds.max}
        increment={1}
        valueLow={tempMinTime()}
        valueHigh={tempMaxTime()}
        onChangeLow={(v) => { setTempMinTime(v); setNeedsSave(true); }}
        onChangeHigh={(v) => { setTempMaxTime(v); setNeedsSave(true); }}
      />
      <div class="ui-gap-sm flex pt-3">
        <div class="flex-1 truncate">
          {tempMinTime().toFixed(0)} to {tempMaxTime().toFixed(0)}
        </div>
        <Show when={needsSave()}>
          <div class="">
            <Button onClick={save} intent="success">Update</Button>
          </div>
        </Show>
      </div>
    </div>
  );
}
