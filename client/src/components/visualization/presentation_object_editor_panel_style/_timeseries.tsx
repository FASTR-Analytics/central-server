import {
  PeriodOption,
  PresentationObjectConfig,
  PresentationObjectDetail,
  get_PERIOD_OPTION_MAP,
} from "platform-lib";
import {
  Checkbox,
  RadioGroup,
  Slider,
  getSelectOptions,
  toPct0,
} from "panther";
import { Match, Show, Switch } from "solid-js";
import { SetStoreFunction } from "solid-js/store";
import { ChartLikeControls } from "./_chart_like_controls";
import { StyleRevealGroup, StyleSection } from "./_style_components";

type Props = {
  poDetail: PresentationObjectDetail;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
  editCustomSeriesStyles: () => Promise<void>;
  showCoverageMode: boolean;
  showPercentChangeMode: boolean;
  showDisruptionsMode: boolean;
};

type TimeseriesMode = "standard" | "coverage" | "percent-change" | "disruptions";

export function TimeseriesStyleControls(p: Props) {
  const periodRadioOptions = () => {
    return p.poDetail.resultsValue.disaggregationOptions
      .filter((d) => d.value === "period_id" || d.value === "quarter_id" || d.value === "year")
      .map((d) => ({
        value: d.value,
        label: get_PERIOD_OPTION_MAP()[d.value as PeriodOption],
      }));
  };

  const mode = (): TimeseriesMode => {
    if (p.tempConfig.s.specialCoverageChart) return "coverage";
    if (p.tempConfig.s.specialBarChart) return "percent-change";
    if (p.tempConfig.s.specialDisruptionsChart) return "disruptions";
    return "standard";
  };

  const setMode = (v: TimeseriesMode) => {
    p.setTempConfig("s", "specialCoverageChart", v === "coverage");
    p.setTempConfig("s", "specialBarChart", v === "percent-change");
    p.setTempConfig("s", "specialDisruptionsChart", v === "disruptions");
    if (v === "coverage") {
      p.setTempConfig("d", "timeseriesGrouping", "year" as PeriodOption);
      p.setTempConfig("s", "content", "lines");
      p.setTempConfig("s", "hideLegend", false);
      p.setTempConfig("s", "allowIndividualRowLimits", false);
    }
    if (v === "percent-change") {
      p.setTempConfig("s", "content", "bars");
      p.setTempConfig("s", "barsStacked", false);
      p.setTempConfig("s", "hideLegend", false);
    }
    if (v === "disruptions") {
      p.setTempConfig("s", "content", "lines-area");
      p.setTempConfig("s", "hideLegend", false);
    }
  };

  const modeOptions = () => {
    const opts: { value: string; label: string }[] = [
      { value: "standard", label: "Standard" },
    ];
    if (p.showCoverageMode || mode() === "coverage") {
      opts.push({ value: "coverage", label: "Special coverage chart" });
    }
    if (p.showPercentChangeMode || mode() === "percent-change") {
      opts.push({ value: "percent-change", label: "Special percent change chart" });
    }
    if (p.showDisruptionsMode || mode() === "disruptions") {
      opts.push({ value: "disruptions", label: "Special disruptions chart" });
    }
    return opts;
  };

  return (
    <>
      <Show when={modeOptions().length > 1}>
        <div class="ui-pad bg-base-200 border-base-300 rounded border">
          <RadioGroup
            label="Chart mode"
            options={modeOptions()}
            value={mode()}
            onChange={(v) => setMode(v as TimeseriesMode)}
          />
        </div>
      </Show>
      <Switch>
        <Match when={mode() === "coverage"}>
          <StyleSection label="Axis">
            <>
              <Show when={p.poDetail.resultsValue.formatAs === "percent"}>
                <Checkbox
                  label="Force y-axis max of 100%"
                  checked={p.tempConfig.s.forceYMax1}
                  onChange={(v) => p.setTempConfig("s", "forceYMax1", v)}
                />
              </Show>
              <Checkbox
                label="Allow auto y-axis min"
                checked={p.tempConfig.s.forceYMinAuto}
                onChange={(v) => p.setTempConfig("s", "forceYMinAuto", v)}
              />
            </>
          </StyleSection>
        </Match>
        <Match when={mode() === "percent-change"}>
          <StyleSection label="Display">
            <RadioGroup
              label="Period"
              options={periodRadioOptions()}
              value={p.tempConfig.d.timeseriesGrouping}
              onChange={(v) => p.setTempConfig("d", "timeseriesGrouping", v as PeriodOption)}
            />
          </StyleSection>
          <StyleSection label="Threshold">
            <>
              <Slider
                label="Threshold value"
                value={p.tempConfig.s.specialBarChartDiffThreshold ?? 0.1}
                onChange={(v) => p.setTempConfig("s", "specialBarChartDiffThreshold", v)}
                fullWidth
                showValueInLabel
                min={0}
                max={0.25}
                step={0.01}
                valueInLabelFormatter={toPct0}
              />
              <Checkbox
                label="Invert red/green for higher/lower"
                checked={p.tempConfig.s.specialBarChartInverted}
                onChange={(v) => p.setTempConfig("s", "specialBarChartInverted", v)}
              />
            </>
          </StyleSection>
          <StyleSection label="Labels">
            <>
              <Checkbox
                checked={p.tempConfig.s.showDataLabels}
                onChange={(v) => p.setTempConfig("s", "showDataLabels", v)}
                label="Show data labels"
              />
              <Show when={p.tempConfig.s.showDataLabels}>
                <StyleRevealGroup>
                  <RadioGroup
                    label="Decimal places"
                    options={getSelectOptions(["0", "1", "2", "3"])}
                    value={String(p.tempConfig.s.decimalPlaces)}
                    onChange={(v) =>
                      p.setTempConfig("s", "decimalPlaces", Number(v) as 0 | 1 | 2 | 3)
                    }
                    horizontal
                  />
                  <Checkbox
                    label="Only show data labels on bars exceeding threshold"
                    checked={
                      p.tempConfig.s.specialBarChartDataLabels === undefined ||
                      p.tempConfig.s.specialBarChartDataLabels === "threshold-values"
                    }
                    onChange={(v) =>
                      p.setTempConfig(
                        "s",
                        "specialBarChartDataLabels",
                        v ? "threshold-values" : "all-values",
                      )
                    }
                  />
                </StyleRevealGroup>
              </Show>
            </>
          </StyleSection>
          <StyleSection label="Axis">
            <>
              <Show when={p.poDetail.resultsValue.formatAs === "percent"}>
                <Checkbox
                  label="Force y-axis max of 100%"
                  checked={p.tempConfig.s.forceYMax1}
                  onChange={(v) => p.setTempConfig("s", "forceYMax1", v)}
                />
              </Show>
              <Checkbox
                label="Allow auto y-axis min"
                checked={p.tempConfig.s.forceYMinAuto}
                onChange={(v) => p.setTempConfig("s", "forceYMinAuto", v)}
              />
              <Checkbox
                label="Allow individual row limits"
                checked={p.tempConfig.s.allowIndividualRowLimits}
                onChange={(v) => p.setTempConfig("s", "allowIndividualRowLimits", v)}
              />
            </>
          </StyleSection>
        </Match>
        <Match when={mode() === "disruptions"}>
          <StyleSection label="Display">
            <>
              <RadioGroup
                label="Period"
                options={periodRadioOptions()}
                value={p.tempConfig.d.timeseriesGrouping}
                onChange={(v) => p.setTempConfig("d", "timeseriesGrouping", v as PeriodOption)}
              />
              <Checkbox
                label="Invert red/green for surplus/disruptions"
                checked={p.tempConfig.s.diffInverted}
                onChange={(v) => p.setTempConfig("s", "diffInverted", v)}
              />
            </>
          </StyleSection>
          <StyleSection label="Labels">
            <>
              <Checkbox
                checked={p.tempConfig.s.showDataLabelsLineCharts}
                onChange={(v) => p.setTempConfig("s", "showDataLabelsLineCharts", v)}
                label="Show data labels"
              />
              <Show when={p.tempConfig.s.showDataLabelsLineCharts}>
                <StyleRevealGroup>
                  <RadioGroup
                    label="Decimal places"
                    options={getSelectOptions(["0", "1", "2", "3"])}
                    value={String(p.tempConfig.s.decimalPlaces)}
                    onChange={(v) =>
                      p.setTempConfig("s", "decimalPlaces", Number(v) as 0 | 1 | 2 | 3)
                    }
                    horizontal
                  />
                </StyleRevealGroup>
              </Show>
            </>
          </StyleSection>
          <StyleSection label="Axis">
            <>
              <Show when={p.poDetail.resultsValue.formatAs === "percent"}>
                <Checkbox
                  label="Force y-axis max of 100%"
                  checked={p.tempConfig.s.forceYMax1}
                  onChange={(v) => p.setTempConfig("s", "forceYMax1", v)}
                />
              </Show>
              <Checkbox
                label="Allow auto y-axis min"
                checked={p.tempConfig.s.forceYMinAuto}
                onChange={(v) => p.setTempConfig("s", "forceYMinAuto", v)}
              />
              <Checkbox
                label="Allow individual row limits"
                checked={p.tempConfig.s.allowIndividualRowLimits}
                onChange={(v) => p.setTempConfig("s", "allowIndividualRowLimits", v)}
              />
            </>
          </StyleSection>
        </Match>
        <Match when={mode() === "standard"}>
          <StyleSection label="Display">
            <>
              <RadioGroup
                label="Period"
                options={periodRadioOptions()}
                value={p.tempConfig.d.timeseriesGrouping}
                onChange={(v) => p.setTempConfig("d", "timeseriesGrouping", v as PeriodOption)}
                horizontal
              />
              <div class="pt-0.5"></div>
              <RadioGroup
                label="Display format"
                options={[
                  { value: "lines", label: "Lines" },
                  { value: "bars", label: "Bars" },
                ]}
                value={
                  p.tempConfig.s.content === "lines-points" || p.tempConfig.s.content === "lines-area"
                    ? "lines"
                    : p.tempConfig.s.content
                }
                onChange={(v) => p.setTempConfig("s", "content", v as "lines" | "bars")}
                horizontal
              />
              <Show when={p.tempConfig.s.content === "bars"}>
                <StyleRevealGroup>
                  <Checkbox
                    label="Stacked bars"
                    checked={p.tempConfig.s.barsStacked}
                    onChange={(v) => p.setTempConfig("s", "barsStacked", v)}
                  />
                </StyleRevealGroup>
              </Show>
              <Show
                when={
                  p.tempConfig.s.content === "lines" ||
                  p.tempConfig.s.content === "lines-points" ||
                  p.tempConfig.s.content === "lines-area"
                }
              >
                <StyleRevealGroup>
                  <Checkbox
                    label="Add points"
                    checked={p.tempConfig.s.content === "lines-points"}
                    onChange={(v) =>
                      p.setTempConfig("s", "content", v ? "lines-points" : "lines")
                    }
                  />
                  <Checkbox
                    label="Fill area"
                    checked={p.tempConfig.s.content === "lines-area"}
                    onChange={(v) =>
                      p.setTempConfig("s", "content", v ? "lines-area" : "lines")
                    }
                  />
                </StyleRevealGroup>
              </Show>
              <div class="pt-0.5"></div>
              <RadioGroup
                label="Decimal places"
                options={getSelectOptions(["0", "1", "2", "3"])}
                value={String(p.tempConfig.s.decimalPlaces)}
                onChange={(v) =>
                  p.setTempConfig("s", "decimalPlaces", Number(v) as 0 | 1 | 2 | 3)
                }
                horizontal
              />
              <div class="pt-0.5"></div>
              <Checkbox
                checked={p.tempConfig.s.hideLegend}
                onChange={(v) => p.setTempConfig("s", "hideLegend", v)}
                label="Hide legend"
              />
            </>
          </StyleSection>
          <ChartLikeControls
            poDetail={p.poDetail}
            tempConfig={p.tempConfig}
            setTempConfig={p.setTempConfig}
            editCustomSeriesStyles={p.editCustomSeriesStyles}
            isColorOverridden={() => false}
          />
        </Match>
      </Switch>
    </>
  );
}
