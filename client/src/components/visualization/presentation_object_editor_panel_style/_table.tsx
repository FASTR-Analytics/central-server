import {
  PresentationObjectConfig,
  PresentationObjectDetail,
  selectCf,
} from "platform-lib";
import { Checkbox, RadioGroup, getSelectOptions } from "panther";
import { Show } from "solid-js";
import { SetStoreFunction } from "solid-js/store";
import { applyCfToTempConfig } from "../cf_store_helper";
import { ConditionalFormattingEditor } from "../conditional_formatting_editor";
import { StyleSection } from "./_style_components";

const METRICS_WITH_NEGATIVE_PCT_VALUES = ["m3-02-02", "m3-03-02", "m3-04-02", "m3-05-02"];

type Props = {
  poDetail: PresentationObjectDetail;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
  showScorecardMode: boolean;
};

type TableMode = "standard" | "scorecard";

export function TableStyleControls(p: Props) {
  const mode = (): TableMode => {
    if (p.tempConfig.s.specialScorecardTable) return "scorecard";
    return "standard";
  };

  const setMode = (v: TableMode) => {
    p.setTempConfig("s", "specialScorecardTable", v === "scorecard");
  };

  const modeOptions = () => {
    const opts: { value: string; label: string }[] = [
      { value: "standard", label: "Standard" },
    ];
    if (p.showScorecardMode || mode() === "scorecard") {
      opts.push({ value: "scorecard", label: "Scorecard table" });
    }
    return opts;
  };

  return (
    <>
      <Show when={modeOptions().length > 1}>
        <div class="ui-pad bg-base-200 border-base-300 rounded border">
          <RadioGroup
            label="Table mode"
            options={modeOptions()}
            value={mode()}
            onChange={(v) => setMode(v as TableMode)}
          />
        </div>
      </Show>
      <StyleSection label="Display">
        <>
          <Checkbox
            label="Allow vertical column headers"
            checked={p.tempConfig.s.allowVerticalColHeaders}
            onChange={(v) => p.setTempConfig("s", "allowVerticalColHeaders", v)}
          />
          <Show when={!p.tempConfig.s.specialScorecardTable}>
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
          </Show>
          <Show when={p.tempConfig.s.specialScorecardTable || selectCf(p.tempConfig.s).type !== "none"}>
            <div class="pt-0.5"></div>
            <Checkbox
              checked={p.tempConfig.s.hideLegend}
              onChange={(v) => p.setTempConfig("s", "hideLegend", v)}
              label="Hide legend"
            />
          </Show>
        </>
      </StyleSection>
      <Show when={!p.tempConfig.s.specialScorecardTable}>
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
    </>
  );
}
