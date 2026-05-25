import { PresentationObjectConfig, PresentationObjectDetail } from "platform-lib";
import { Checkbox, LabelHolder, RadioGroup } from "panther";
import { Show } from "solid-js";
import { SetStoreFunction } from "solid-js/store";
import { ChartLikeControls } from "./_chart_like_controls";
import { StyleRevealGroup, StyleSection } from "./_style_components";

type Props = {
  poDetail: PresentationObjectDetail;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
  editCustomSeriesStyles: () => Promise<void>;
};

export function ChartStyleControls(p: Props) {
  return (
    <>
      <StyleSection label="Display">
        <>
          <RadioGroup
            label="Display format"
            options={[
              { value: "bars", label: "Bars" },
              { value: "points", label: "Points" },
              { value: "lines", label: "Lines" },
            ]}
            value={
              p.tempConfig.s.content === "lines-points" || p.tempConfig.s.content === "lines-area"
                ? "lines"
                : p.tempConfig.s.content
            }
            onChange={(v) =>
              p.setTempConfig("s", "content", v as "bars" | "points" | "lines")
            }
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
          <Checkbox
            label="Horizontal"
            checked={p.tempConfig.s.horizontal ?? false}
            onChange={(v) => p.setTempConfig("s", "horizontal", v)}
          />
          <Show when={!p.tempConfig.s.horizontal}>
            <StyleRevealGroup>
              <Checkbox
                label="Vertical tick labels"
                checked={p.tempConfig.s.verticalTickLabels}
                onChange={(v) => p.setTempConfig("s", "verticalTickLabels", v)}
              />
            </StyleRevealGroup>
          </Show>
          <div class="pt-0.5"></div>
          <Checkbox
            checked={p.tempConfig.s.hideLegend}
            onChange={(v) => p.setTempConfig("s", "hideLegend", v)}
            label="Hide legend"
          />
        </>
      </StyleSection>
      <StyleSection label="Sorting">
        <LabelHolder label="Sort indicator values">
          <div class="ui-spy-sm">
            <Checkbox
              label="Descending"
              checked={p.tempConfig.s.sortIndicatorValues === "descending"}
              onChange={(v) =>
                p.setTempConfig("s", "sortIndicatorValues", v ? "descending" : "none")
              }
            />
            <Checkbox
              label="Ascending"
              checked={p.tempConfig.s.sortIndicatorValues === "ascending"}
              onChange={(v) =>
                p.setTempConfig("s", "sortIndicatorValues", v ? "ascending" : "none")
              }
            />
          </div>
        </LabelHolder>
      </StyleSection>
      <ChartLikeControls
        poDetail={p.poDetail}
        tempConfig={p.tempConfig}
        setTempConfig={p.setTempConfig}
        editCustomSeriesStyles={p.editCustomSeriesStyles}
        isColorOverridden={() => false}
      />
    </>
  );
}
