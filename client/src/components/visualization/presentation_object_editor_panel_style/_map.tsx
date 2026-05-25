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
import { StyleRevealGroup, StyleSection } from "./_style_components";

const METRICS_WITH_NEGATIVE_PCT_VALUES = ["m3-02-02", "m3-03-02", "m3-04-02", "m3-05-02"];

type Props = {
  poDetail: PresentationObjectDetail;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
};

export function MapStyleControls(p: Props) {
  return (
    <>
      <StyleSection label="Display">
        <>
          <RadioGroup
            label="Map projection"
            options={[
              { value: "equirectangular", label: "Equirectangular" },
              { value: "mercator", label: "Mercator" },
              { value: "naturalEarth1", label: "Natural Earth" },
            ]}
            value={p.tempConfig.s.mapProjection}
            onChange={(v) =>
              p.setTempConfig(
                "s",
                "mapProjection",
                v as "equirectangular" | "mercator" | "naturalEarth1",
              )
            }
          />
          <div class="pt-0.5"></div>
          <Checkbox
            checked={p.tempConfig.s.hideLegend}
            onChange={(v) => p.setTempConfig("s", "hideLegend", v)}
            label="Hide legend"
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
      <StyleSection label="Labels">
        <>
          <Checkbox
            checked={p.tempConfig.s.mapShowRegionLabels ?? false}
            onChange={(v) => p.setTempConfig("s", "mapShowRegionLabels", v)}
            label="Show region labels"
          />
          <Checkbox
            checked={p.tempConfig.s.showDataLabels}
            onChange={(v) => p.setTempConfig("s", "showDataLabels", v)}
            label="Show data labels"
          />
          <Show when={p.tempConfig.s.mapShowRegionLabels || p.tempConfig.s.showDataLabels}>
            <StyleRevealGroup>
              <RadioGroup
                label="Label placement"
                options={[
                  { value: "centroid", label: "Center" },
                  { value: "callout", label: "Callout" },
                  { value: "auto", label: "Auto" },
                ]}
                value={p.tempConfig.s.mapDataLabelMode ?? "centroid"}
                onChange={(v) =>
                  p.setTempConfig("s", "mapDataLabelMode", v as "centroid" | "callout" | "auto")
                }
              />
            </StyleRevealGroup>
          </Show>
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
            </StyleRevealGroup>
          </Show>
        </>
      </StyleSection>
    </>
  );
}
