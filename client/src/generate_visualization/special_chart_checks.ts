import type { PresentationObjectConfig } from "platform-lib";

// Metrics that support each special chart mode
export const SPECIAL_COVERAGE_CHART_METRICS = [
  "m4-01-01",
  "m6-01-01",
  "m6-02-01",
  "m6-03-01",
];

export const SPECIAL_PERCENT_CHANGE_CHART_METRICS = ["m3-01-01"];

export const SPECIAL_DISRUPTIONS_CHART_METRICS = [
  "m3-02-01",
  "m3-03-01",
  "m3-04-01",
  "m3-05-01",
];

export const SPECIAL_SCORECARD_TABLE_METRICS = ["m8-01-01"];

// "Can this metric use X mode?" — controls whether toggle is shown in editor
export function canUseSpecialCoverageChart(metricId: string): boolean {
  return SPECIAL_COVERAGE_CHART_METRICS.includes(metricId);
}

export function canUseSpecialPercentChangeChart(metricId: string): boolean {
  return SPECIAL_PERCENT_CHANGE_CHART_METRICS.includes(metricId);
}

export function canUseSpecialDisruptionsChart(metricId: string): boolean {
  return SPECIAL_DISRUPTIONS_CHART_METRICS.includes(metricId);
}

export function canUseSpecialScorecardTable(metricId: string): boolean {
  return SPECIAL_SCORECARD_TABLE_METRICS.includes(metricId);
}

// "Is X mode currently active?" — controls rendering behavior
export function isSpecialScorecardTableActive(config: PresentationObjectConfig): boolean {
  return config.s.specialScorecardTable === true && config.d.type === "table";
}

export function isSpecialBarChartActive(config: PresentationObjectConfig): boolean {
  return config.s.specialBarChart === true && config.d.type === "timeseries";
}

export function isSpecialCoverageChartActive(config: PresentationObjectConfig): boolean {
  return config.s.specialCoverageChart === true && config.d.type === "timeseries";
}

export function isSpecialDisruptionsChartActive(config: PresentationObjectConfig): boolean {
  return config.s.specialDisruptionsChart === true && config.d.type === "timeseries";
}
