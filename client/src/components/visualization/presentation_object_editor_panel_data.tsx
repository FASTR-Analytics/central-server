import {
  IneffectiveDisaggregator,
  PresentationObjectConfig,
  PresentationObjectDetail,
  ResultsValueInfoForPresentationObject,
} from "platform-lib";
import { SetStoreFunction } from "solid-js/store";
import {
  DataValuesSummary,
  PresentationTypeSummary,
} from "./presentation_object_editor_panel_data/_1_summary";
import { Filters } from "./presentation_object_editor_panel_data/_2_filters";
import { DisaggregationSection } from "./presentation_object_editor_panel_data/_3_disaggregation";

type Props = {
  projectId: string;
  poDetail: PresentationObjectDetail;
  resultsValueInfo: ResultsValueInfoForPresentationObject;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
  ineffectiveDisaggregators: IneffectiveDisaggregator[];
  effectiveValueProps: string[];
  hasMultipleValueProps: boolean;
};

export function PresentationObjectEditorPanelData(p: Props) {
  const allowedFilterOptions = () => {
    return p.poDetail.resultsValue.disaggregationOptions.filter((disOpt) => {
      if (disOpt.allowedPresentationOptions && !disOpt.allowedPresentationOptions.includes(p.tempConfig.d.type)) {
        return false;
      }
      const possibleValues = p.resultsValueInfo.disaggregationPossibleValues[disOpt.value];
      if (!possibleValues || possibleValues.status === "no_values_available") {
        return false;
      }
      return true;
    });
  };

  return (
    <div class="ui-pad ui-spy h-full w-full overflow-auto">
      <DataValuesSummary poDetail={p.poDetail} />
      <PresentationTypeSummary
        tempConfig={p.tempConfig}
        setTempConfig={p.setTempConfig}
        disaggregationOptions={p.poDetail.resultsValue.disaggregationOptions}
      />

      <Filters
        poDetail={p.poDetail}
        tempConfig={p.tempConfig}
        setTempConfig={p.setTempConfig}
        resultsValueInfo={p.resultsValueInfo}
        allowedFilterOptions={allowedFilterOptions()}
      />

      <DisaggregationSection
        poDetail={p.poDetail}
        tempConfig={p.tempConfig}
        setTempConfig={p.setTempConfig}
        allDisaggregationOptions={allowedFilterOptions()}
        ineffectiveDisaggregators={p.ineffectiveDisaggregators}
        effectiveValueProps={p.effectiveValueProps}
        hasMultipleValueProps={p.hasMultipleValueProps}
      />
    </div>
  );
}
