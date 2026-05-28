import {
  ChartOHJsonDataConfig,
  ChartOVJsonDataConfig,
  HeaderItem,
  HeaderSortConfig,
  TableJsonDataConfig,
  TimeseriesJsonDataConfig,
} from "panther";
import {
  PresentationObjectConfig,
  ResultsValueForVisualization,
  getDisaggregatorDisplayProp,
  get_INDICATOR_COMMON_IDS_IN_SORT_ORDER,
  t3,
  TC,
} from "platform-lib";
import { getDateLabelReplacements } from "./get_date_label_replacements";

function includesIndicatorDisaggregation(config: PresentationObjectConfig): boolean {
  return config.d.disaggregateBy.some((d) => d.disOpt === "indicator_common_id");
}

function buildLabelReplacements(
  resultsValue: ResultsValueForVisualization,
  indicatorLabelReplacements: Record<string, string>,
  dateLabelReplacements: Record<string, string>,
): Record<string, string> {
  return {
    ...(resultsValue.valueLabelReplacements ?? {}),
    ...indicatorLabelReplacements,
    ...dateLabelReplacements,
    __NATIONAL: t3(TC.national),
    zzNATIONAL: t3(TC.national),
  };
}

function getChartIndicatorSort(config: PresentationObjectConfig): HeaderSortConfig {
  return includesIndicatorDisaggregation(config)
    ? { byIdOrder: get_INDICATOR_COMMON_IDS_IN_SORT_ORDER() }
    : "by-label";
}

function nationalAwareSortByLabel(a: HeaderItem, b: HeaderItem): number {
  const aPri = a.id === "__NATIONAL" ? -1 : a.id === "zzNATIONAL" ? 1 : 0;
  const bPri = b.id === "__NATIONAL" ? -1 : b.id === "zzNATIONAL" ? 1 : 0;
  if (aPri !== bPri) return aPri - bPri;
  return a.label.localeCompare(b.label);
}

export function getTimeseriesJsonDataConfigFromPresentationObjectConfig(
  resultsValue: ResultsValueForVisualization,
  config: PresentationObjectConfig,
  effectiveValueProps: string[],
  indicatorLabelReplacements: Record<string, string>,
  jsonArray?: any[],
): TimeseriesJsonDataConfig {
  if (config.d.type !== "timeseries") {
    throw new Error("Bad config type");
  }
  if (!config.d.timeseriesGrouping) {
    throw new Error("Timeseries config missing timeseriesGrouping");
  }

  const periodType =
    config.d.timeseriesGrouping === "period_id"
      ? "year-month"
      : config.d.timeseriesGrouping === "quarter_id"
        ? "year-quarter"
        : "year";

  return {
    valueProps: effectiveValueProps,
    periodProp: config.d.timeseriesGrouping,
    periodType,
    seriesProp:
      getDisaggregatorDisplayProp(resultsValue, config, ["series"], effectiveValueProps) ?? "--v",
    paneProp: getDisaggregatorDisplayProp(resultsValue, config, ["cell"], effectiveValueProps),
    laneProp: getDisaggregatorDisplayProp(resultsValue, config, ["col", "colGroup"], effectiveValueProps),
    tierProp: getDisaggregatorDisplayProp(resultsValue, config, ["row", "rowGroup"], effectiveValueProps),
    sort: {
      series: nationalAwareSortByLabel,
      lane: nationalAwareSortByLabel,
      tier: nationalAwareSortByLabel,
      pane: nationalAwareSortByLabel,
    },
    labelReplacements: buildLabelReplacements(resultsValue, indicatorLabelReplacements, {}),
  };
}

export function getTableJsonDataConfigFromPresentationObjectConfig(
  resultsValue: ResultsValueForVisualization,
  config: PresentationObjectConfig,
  effectiveValueProps: string[],
  indicatorLabelReplacements: Record<string, string>,
  jsonArray?: any[],
  customSortHeaders?: string[],
): TableJsonDataConfig {
  if (config.d.type !== "table") {
    throw new Error("Bad config type");
  }

  const colProp =
    getDisaggregatorDisplayProp(resultsValue, config, ["col"], effectiveValueProps) ?? "--v";
  const rowProp = getDisaggregatorDisplayProp(resultsValue, config, ["row"], effectiveValueProps);
  const colGroupProp = getDisaggregatorDisplayProp(resultsValue, config, ["colGroup"], effectiveValueProps);
  const rowGroupProp = getDisaggregatorDisplayProp(resultsValue, config, ["rowGroup"], effectiveValueProps);

  const dateLabelReplacements = jsonArray
    ? getDateLabelReplacements(jsonArray, [colProp, rowProp, colGroupProp, rowGroupProp])
    : {};

  const tableSort: HeaderSortConfig = customSortHeaders
    ? { byIdOrder: customSortHeaders }
    : includesIndicatorDisaggregation(config)
      ? { byIdOrder: get_INDICATOR_COMMON_IDS_IN_SORT_ORDER() }
      : "by-label";

  return {
    valueProps: effectiveValueProps,
    colProp,
    rowProp,
    colGroupProp,
    rowGroupProp,
    sort: { colGroup: tableSort, col: tableSort, rowGroup: tableSort, row: tableSort },
    labelReplacements: buildLabelReplacements(resultsValue, indicatorLabelReplacements, dateLabelReplacements),
  };
}

function getChartJsonDataConfig(
  resultsValue: ResultsValueForVisualization,
  config: PresentationObjectConfig,
  effectiveValueProps: string[],
  indicatorLabelReplacements: Record<string, string>,
  jsonArray?: any[],
) {
  if (config.d.type !== "chart") {
    throw new Error("Bad config type");
  }

  const indicatorProp =
    getDisaggregatorDisplayProp(resultsValue, config, ["indicator"], effectiveValueProps) ?? "--v";
  const seriesProp = getDisaggregatorDisplayProp(resultsValue, config, ["series"], effectiveValueProps);
  const paneProp = getDisaggregatorDisplayProp(resultsValue, config, ["cell"], effectiveValueProps);
  const laneProp = getDisaggregatorDisplayProp(resultsValue, config, ["col", "colGroup"], effectiveValueProps);
  const tierProp = getDisaggregatorDisplayProp(resultsValue, config, ["row", "rowGroup"], effectiveValueProps);

  const dateLabelReplacements = jsonArray
    ? getDateLabelReplacements(jsonArray, [indicatorProp, seriesProp, paneProp, laneProp, tierProp])
    : {};

  return {
    valueProps: effectiveValueProps,
    indicatorProp,
    seriesProp,
    paneProp,
    laneProp,
    tierProp,
    sort: {
      indicator: getChartIndicatorSort(config),
      series: nationalAwareSortByLabel,
      lane: nationalAwareSortByLabel,
      tier: nationalAwareSortByLabel,
      pane: nationalAwareSortByLabel,
    },
    sortIndicatorValues: config.s.sortIndicatorValues,
    labelReplacements: buildLabelReplacements(resultsValue, indicatorLabelReplacements, dateLabelReplacements),
  };
}

export function getChartOVJsonDataConfigFromPresentationObjectConfig(
  resultsValue: ResultsValueForVisualization,
  config: PresentationObjectConfig,
  effectiveValueProps: string[],
  indicatorLabelReplacements: Record<string, string>,
  jsonArray?: any[],
): ChartOVJsonDataConfig {
  return getChartJsonDataConfig(resultsValue, config, effectiveValueProps, indicatorLabelReplacements, jsonArray);
}

export function getChartOHJsonDataConfigFromPresentationObjectConfig(
  resultsValue: ResultsValueForVisualization,
  config: PresentationObjectConfig,
  effectiveValueProps: string[],
  indicatorLabelReplacements: Record<string, string>,
  jsonArray?: any[],
): ChartOHJsonDataConfig {
  return getChartJsonDataConfig(resultsValue, config, effectiveValueProps, indicatorLabelReplacements, jsonArray);
}
