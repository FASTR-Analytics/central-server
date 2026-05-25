import {
  PresentationObjectConfig,
  PresentationObjectDetail,
  ResultsValueInfoForPresentationObject,
  getEffectivePOConfig,
  getPeriodFilterExactBounds,
} from "platform-lib";
import { Match, Switch, createSignal } from "solid-js";
import { SetStoreFunction } from "solid-js/store";
import { PresentationObjectEditorPanelData } from "./presentation_object_editor_panel_data";
import { PresentationObjectEditorPanelStyle } from "./presentation_object_editor_panel_style";
import { PresentationObjectEditorPanelText } from "./presentation_object_editor_panel_text";

type Props = {
  projectId: string;
  poDetail: PresentationObjectDetail;
  resultsValueInfo: ResultsValueInfoForPresentationObject;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
};

export function PresentationObjectEditorPanel(p: Props) {
  const [tab, setTab] = createSignal<"data" | "style" | "text">("data");

  const resolvedPeriodBounds = () => {
    const pf = p.tempConfig.d.periodFilter;
    if (!pf) return undefined;
    return getPeriodFilterExactBounds(pf, p.resultsValueInfo.periodBounds);
  };

  const effectivePOConfigResult = () => {
    return getEffectivePOConfig(p.tempConfig, {
      dateRange: resolvedPeriodBounds(),
      valueProps: p.poDetail.resultsValue.valueProps,
    });
  };

  return (
    <div class="flex h-full w-full flex-col border-r">
      <div class="flex w-full flex-none border-b">
        <div
          class="ui-hoverable data-[selected=true]:bg-base-200 flex-1 truncate border-r px-2 py-2 text-center"
          onClick={() => setTab("data")}
          data-selected={tab() === "data"}
        >
          Data
        </div>
        <div
          class="ui-hoverable data-[selected=true]:bg-base-200 flex-1 truncate border-r px-2 py-2 text-center"
          onClick={() => setTab("style")}
          data-selected={tab() === "style"}
        >
          Presentation
        </div>
        <div
          class="ui-hoverable data-[selected=true]:bg-base-200 flex-1 truncate px-2 py-2 text-center"
          onClick={() => setTab("text")}
          data-selected={tab() === "text"}
        >
          Text
        </div>
      </div>
      <div class="h-0 w-full flex-1">
        <Switch>
          <Match when={tab() === "data"}>
            <PresentationObjectEditorPanelData
              projectId={p.projectId}
              poDetail={p.poDetail}
              resultsValueInfo={p.resultsValueInfo}
              tempConfig={p.tempConfig}
              setTempConfig={p.setTempConfig}
              ineffectiveDisaggregators={effectivePOConfigResult().ineffectiveDisaggregators}
              effectiveValueProps={effectivePOConfigResult().effectiveValueProps}
              hasMultipleValueProps={effectivePOConfigResult().hasMultipleValueProps}
            />
          </Match>
          <Match when={tab() === "style"}>
            <PresentationObjectEditorPanelStyle
              projectId={p.projectId}
              poDetail={p.poDetail}
              tempConfig={p.tempConfig}
              setTempConfig={p.setTempConfig}
              effectiveConfig={effectivePOConfigResult().config}
              effectiveValueProps={effectivePOConfigResult().effectiveValueProps}
            />
          </Match>
          <Match when={tab() === "text"}>
            <PresentationObjectEditorPanelText
              projectId={p.projectId}
              poDetail={p.poDetail}
              tempConfig={p.tempConfig}
              setTempConfig={p.setTempConfig}
            />
          </Match>
        </Switch>
      </div>
    </div>
  );
}
