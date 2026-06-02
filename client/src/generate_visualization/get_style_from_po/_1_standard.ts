import {
  ChartValueInfo,
  CustomFigureStyleOptions,
  getFormatterFunc,
  type TickLabelFormatterOption,
} from "panther";
import {
  type DeckStyleContext,
  getCalendar,
  PresentationObjectConfig,
  selectCf,
} from "platform-lib";
import { compileCfToValuesColorFunc } from "../conditional_formatting/compile";
import {
  getMapRegionsContent,
  getStandardSeriesColorFunc,
  getTableCellsContent,
  getTableLayoutStyle,
  getTextStyle,
} from "./_0_common";
import { getAdminAreaLevelFromMapConfig } from "../get_admin_area_level_from_config";

export function buildStandardStyle(
  config: PresentationObjectConfig,
  formatAs: "percent" | "number",
  deckStyle?: DeckStyleContext,
): CustomFigureStyleOptions {
  const dataFormat = formatAs;
  const cf = selectCf(config.s);
  const cfOn = cf.type !== "none";
  const c = config.s.content;
  const showPoints = c === "points" || c === "lines-points";
  const showLines = c === "lines" || c === "lines-area" || c === "lines-points";
  const showAreas = c === "lines-area";

  return {
    seriesColorFunc: getStandardSeriesColorFunc(config),
    text: getTextStyle(config, deckStyle),
    surrounds: {
      legendPosition: config.s.hideLegend ? "none" : undefined,
    },
    legend: {
      reverseOrder: config.s.content === "bars" && config.s.barsStacked,
    },
    grid: {
      showGrid: config.d.type !== "table" || cf.type === "none",
    },
    panes: {
      nCols: config.s.nColsInCellDisplay,
    },
    xTextAxis: {
      verticalTickLabels: config.s.verticalTickLabels,
      tickPosition: config.s.content === "points" ? "center" : undefined,
    },
    yTextAxis: {
      tickPosition: config.s.content === "points" ? "center" : undefined,
    },
    xPeriodAxis: {
      forceSideTicksWhenYear: config.s.content === "bars",
      calendar: getCalendar(),
    },
    yScaleAxis: {
      allowIndividualTierLimits: config.s.allowIndividualRowLimits,
      max: config.s.forceYMax1 ? 1 : undefined,
      min: config.s.forceYMinAuto ? "auto" : undefined,
      tickLabelFormatter: (dataFormat === "percent"
        ? "auto-percent"
        : "auto-number") as TickLabelFormatterOption,
    },
    xScaleAxis: {
      allowIndividualLaneLimits: config.s.allowIndividualRowLimits,
      max: config.s.forceYMax1 ? 1 : undefined,
      min: config.s.forceYMinAuto ? "auto" : undefined,
      tickLabelFormatter: (dataFormat === "percent"
        ? "auto-percent"
        : "auto-number") as TickLabelFormatterOption,
    },
    content: {
      points: {
        func: {
          show: showPoints,
          dataLabel: { show: config.s.showDataLabels },
        },
        textFormatter: (info: ChartValueInfo) =>
          getFormatterFunc(dataFormat, config.s.decimalPlaces ?? 0)(info.val),
      },
      bars: {
        func:
          c !== "bars"
            ? { show: false }
            : cfOn
              ? {
                  show: true,
                  fillColor: 777 as const,
                  dataLabel: { show: config.s.showDataLabels },
                }
              : { show: true, dataLabel: { show: config.s.showDataLabels } },
        textFormatter: (info: ChartValueInfo) =>
          getFormatterFunc(dataFormat, config.s.decimalPlaces ?? 0)(info.val),
        stacking: c === "bars" && config.s.barsStacked ? "stacked" : "none",
      },
      lines: {
        func: {
          show: showLines,
          dataLabel: { show: config.s.showDataLabelsLineCharts },
        },
        textFormatter: (info: ChartValueInfo) =>
          getFormatterFunc(dataFormat, config.s.decimalPlaces ?? 0)(info.val),
      },
      areas: {
        func: { show: showAreas },
      },
      tableCells: getTableCellsContent(config, formatAs),
      mapRegions: getMapRegionsContent(config, formatAs),
    },
    table: getTableLayoutStyle(config),
    valuesColorFunc: compileCfToValuesColorFunc(cf),
    map:
      config.d.type === "map"
        ? {
            projection: config.s.mapProjection ?? "equirectangular",
            dataLabelMode: config.s.mapDataLabelMode ?? "centroid",
            fit:
              (getAdminAreaLevelFromMapConfig(config) ?? 0) >= 3
                ? "only-regions-in-data"
                : undefined,
          }
        : undefined,
  };
}
