import {
  PresentationObjectConfig,
  PresentationObjectDetail,
  selectCf,
} from "platform-lib";
import { Button, Checkbox, RadioGroup, Select, getSelectOptions } from "panther";
import { Show } from "solid-js";
import { SetStoreFunction } from "solid-js/store";
import { applyCfToTempConfig } from "../cf_store_helper";
import { ConditionalFormattingEditor } from "../conditional_formatting_editor";
import { StyleRevealGroup, StyleSection } from "./_style_components";

const METRICS_WITH_NEGATIVE_PCT_VALUES = ["m3-02-02", "m3-03-02", "m3-04-02", "m3-05-02"];

type Props = {
  poDetail: PresentationObjectDetail;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
  editCustomSeriesStyles: () => Promise<void>;
  isColorOverridden: () => boolean;
};

export function ChartLikeControls(p: Props) {
  return (
    <>
      <Show when={!p.isColorOverridden()}>
        <StyleSection label="Colors">
          <>
            <Select
              label="Color scale"
              options={[
                { value: "pastel-discrete", label: "Discrete 1" },
                { value: "alt-discrete", label: "Discrete 2" },
                { value: "red-green", label: "Red-green" },
                { value: "blue-green", label: "Blue-green" },
                { value: "single-grey", label: "Single grey" },
                { value: "custom", label: "Custom colours" },
              ]}
              value={p.tempConfig.s.colorScale}
              onChange={(v) =>
                p.setTempConfig(
                  "s",
                  "colorScale",
                  v as "pastel-discrete" | "alt-discrete" | "red-green" | "blue-green" | "single-grey" | "custom",
                )
              }
              fullWidth
            />
            <Show when={p.tempConfig.s.colorScale === "custom"}>
              <StyleRevealGroup>
                <Button onClick={p.editCustomSeriesStyles} iconName="settings">
                  Set custom colours
                </Button>
              </StyleRevealGroup>
            </Show>
            <Select
              label="Color scale mapping"
              options={
                p.tempConfig.d.type === "timeseries"
                  ? [
                      { value: "series", label: "Series (lines/bars)" },
                      { value: "cell", label: "Grid cells" },
                      { value: "col", label: "Column groups" },
                      { value: "row", label: "Row groups" },
                    ]
                  : [
                      { value: "series", label: "Series (sub-bars)" },
                      { value: "cell", label: "Grid cells" },
                      { value: "col", label: "Column groups" },
                      { value: "row", label: "Row groups" },
                    ]
              }
              value={p.tempConfig.s.seriesColorFuncPropToUse}
              onChange={(v) =>
                p.setTempConfig("s", "seriesColorFuncPropToUse", v as "series" | "cell" | "col" | "row")
              }
              fullWidth
            />
          </>
        </StyleSection>
        <StyleSection label="Conditional formatting">
          <ConditionalFormattingEditor
            value={selectCf(p.tempConfig.s)}
            onChange={(cf) => applyCfToTempConfig(p.setTempConfig, cf)}
            formatAs={p.poDetail.resultsValue.formatAs}
            decimalPlaces={p.tempConfig.s.decimalPlaces}
            allowNegative={METRICS_WITH_NEGATIVE_PCT_VALUES.includes(p.poDetail.resultsValue.id)}
          />
        </StyleSection>
      </Show>
      <StyleSection label="Labels">
        <>
          <Show when={p.tempConfig.s.content === "bars" || p.tempConfig.s.content === "points"}>
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
                  onChange={(v) => p.setTempConfig("s", "decimalPlaces", Number(v) as 0 | 1 | 2 | 3)}
                  horizontal
                />
              </StyleRevealGroup>
            </Show>
          </Show>
          <Show
            when={
              p.tempConfig.s.content === "lines" ||
              p.tempConfig.s.content === "lines-area" ||
              p.tempConfig.s.content === "lines-points"
            }
          >
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
                  onChange={(v) => p.setTempConfig("s", "decimalPlaces", Number(v) as 0 | 1 | 2 | 3)}
                  horizontal
                />
              </StyleRevealGroup>
            </Show>
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
    </>
  );
}
