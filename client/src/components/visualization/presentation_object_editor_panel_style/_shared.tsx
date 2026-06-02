import { PresentationObjectConfig, PresentationObjectDetail } from "platform-lib";
import { Checkbox, LabelHolder, Slider, toNum0 } from "panther";
import { Show } from "solid-js";
import { SetStoreFunction } from "solid-js/store";
import { StyleRevealGroup } from "./_style_components";

type SharedTopProps = {
  poDetail: PresentationObjectDetail;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
  usingCells: () => boolean;
};

export function SharedControlsTop(p: SharedTopProps) {
  return (
    <>
      <Show when={p.usingCells()}>
        <LabelHolder label="Number of grid columns">
          <div class="ui-spy-sm">
            <Checkbox
              label="Auto"
              checked={p.tempConfig.s.nColsInCellDisplay === "auto"}
              onChange={(v) => {
                if (v) {
                  p.setTempConfig("s", "nColsInCellDisplay", "auto");
                } else {
                  p.setTempConfig("s", "nColsInCellDisplay", 2);
                }
              }}
            />
            <Show when={p.tempConfig.s.nColsInCellDisplay !== "auto"}>
              <StyleRevealGroup>
                <Slider
                  label="Columns"
                  min={1}
                  max={10}
                  step={1}
                  value={p.tempConfig.s.nColsInCellDisplay as number}
                  onChange={(v) => p.setTempConfig("s", "nColsInCellDisplay", v)}
                  fullWidth
                  showValueInLabel
                />
              </StyleRevealGroup>
            </Show>
          </div>
        </LabelHolder>
      </Show>
    </>
  );
}
