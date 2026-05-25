import {
  PresentationObjectConfig,
  PresentationObjectDetail,
  getDisaggregatorDisplayProp,
} from "platform-lib";
import { openComponent } from "panther";
import { Match, Switch } from "solid-js";
import { SetStoreFunction, unwrap } from "solid-js/store";
import { CustomSeriesStyles } from "./custom_series_styles";
import {
  canUseSpecialCoverageChart,
  canUseSpecialDisruptionsChart,
  canUseSpecialPercentChangeChart,
  canUseSpecialScorecardTable,
} from "./special_chart_checks";
import { SharedControlsTop } from "./presentation_object_editor_panel_style/_shared";
import { TimeseriesStyleControls } from "./presentation_object_editor_panel_style/_timeseries";
import { ChartStyleControls } from "./presentation_object_editor_panel_style/_chart";
import { TableStyleControls } from "./presentation_object_editor_panel_style/_table";
import { MapStyleControls } from "./presentation_object_editor_panel_style/_map";

type Props = {
  projectId: string;
  poDetail: PresentationObjectDetail;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
  effectiveConfig: PresentationObjectConfig;
  effectiveValueProps: string[];
};

export function PresentationObjectEditorPanelStyle(p: Props) {
  const metricId = () => p.poDetail.resultsValue.id;

  const showCoverageMode = () => canUseSpecialCoverageChart(metricId());
  const showPercentChangeMode = () => canUseSpecialPercentChangeChart(metricId());
  const showDisruptionsMode = () => canUseSpecialDisruptionsChart(metricId());
  const showScorecardMode = () => canUseSpecialScorecardTable(metricId());

  async function editCustomSeriesStyles() {
    const res = await openComponent({
      element: CustomSeriesStyles,
      props: {
        starting: p.tempConfig.s.customSeriesStyles
          ? unwrap(p.tempConfig.s.customSeriesStyles)
          : undefined,
      },
    });
    if (res) {
      p.setTempConfig("s", "customSeriesStyles", res);
    }
  }

  const usingCells = () =>
    !!getDisaggregatorDisplayProp(p.poDetail.resultsValue, p.effectiveConfig, ["cell"], p.effectiveValueProps);

  return (
    <div class="ui-pad ui-spy h-full w-full overflow-auto">
      <SharedControlsTop
        poDetail={p.poDetail}
        tempConfig={p.tempConfig}
        setTempConfig={p.setTempConfig}
        usingCells={usingCells}
      />
      <Switch>
        <Match when={p.tempConfig.d.type === "timeseries"}>
          <TimeseriesStyleControls
            poDetail={p.poDetail}
            tempConfig={p.tempConfig}
            setTempConfig={p.setTempConfig}
            editCustomSeriesStyles={editCustomSeriesStyles}
            showCoverageMode={showCoverageMode()}
            showPercentChangeMode={showPercentChangeMode()}
            showDisruptionsMode={showDisruptionsMode()}
          />
        </Match>
        <Match when={p.tempConfig.d.type === "chart"}>
          <ChartStyleControls
            poDetail={p.poDetail}
            tempConfig={p.tempConfig}
            setTempConfig={p.setTempConfig}
            editCustomSeriesStyles={editCustomSeriesStyles}
          />
        </Match>
        <Match when={p.tempConfig.d.type === "table"}>
          <TableStyleControls
            poDetail={p.poDetail}
            tempConfig={p.tempConfig}
            setTempConfig={p.setTempConfig}
            showScorecardMode={showScorecardMode()}
          />
        </Match>
        <Match when={p.tempConfig.d.type === "map"}>
          <MapStyleControls
            poDetail={p.poDetail}
            tempConfig={p.tempConfig}
            setTempConfig={p.setTempConfig}
          />
        </Match>
      </Switch>
    </div>
  );
}
