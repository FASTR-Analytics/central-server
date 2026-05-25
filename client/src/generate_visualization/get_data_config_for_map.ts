import type { MapJsonDataConfig } from "panther";
import {
  type PresentationObjectConfig,
  type ResultsValueForVisualization,
  getDisaggregatorDisplayProp,
} from "platform-lib";

export function getMapJsonDataConfigFromPresentationObjectConfig(
  resultsValue: ResultsValueForVisualization,
  config: PresentationObjectConfig,
  effectiveValueProps: string[],
  indicatorLabelReplacements: Record<string, string>,
): MapJsonDataConfig {
  if (config.d.type !== "map") {
    throw new Error("Bad config type");
  }

  const valueProp = effectiveValueProps[0] ?? "value";

  const areaProp =
    getDisaggregatorDisplayProp(resultsValue, config, ["mapArea"], effectiveValueProps) ?? "admin_area_2";

  const paneProp = getDisaggregatorDisplayProp(resultsValue, config, ["cell"], effectiveValueProps);
  const laneProp = getDisaggregatorDisplayProp(resultsValue, config, ["col"], effectiveValueProps);
  const tierProp = getDisaggregatorDisplayProp(resultsValue, config, ["row"], effectiveValueProps);

  const dataConfig: MapJsonDataConfig = {
    valueProp,
    areaProp,
    areaMatchProp: "area_id",
    paneProp,
    tierProp,
    laneProp,
    labelReplacements: indicatorLabelReplacements,
  };

  return dataConfig;
}
