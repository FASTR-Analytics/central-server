import {
  ChartValueInfo,
  CustomFigureStyleOptions,
  getFormatterFunc,
  type TickLabelFormatterOption,
} from "panther";
import {
  _CF_COMPARISON,
  _CF_GREEN,
  _CF_RED,
  type DeckStyleContext,
  getCalendar,
  PresentationObjectConfig,
} from "platform-lib";
import { getStandardSeriesColorFunc, getTextStyle } from "./_0_common";

export function buildPercentChangeChartStyle(
  config: PresentationObjectConfig,
  formatAs: "percent" | "number",
  deckStyle?: DeckStyleContext,
): CustomFigureStyleOptions {
  const threshold = config.s.specialBarChartDiffThreshold ?? 0.1;
  const inverted = config.s.specialBarChartInverted;

  return {
    scale: config.s.scale,
    seriesColorFunc: getStandardSeriesColorFunc(config),
    text: getTextStyle(config, deckStyle),
    panes: { nCols: config.s.nColsInCellDisplay },
    xPeriodAxis: { forceSideTicksWhenYear: true, calendar: getCalendar() },
    yScaleAxis: {
      allowIndividualTierLimits: config.s.allowIndividualRowLimits,
      max: config.s.forceYMax1 ? 1 : undefined,
      min: config.s.forceYMinAuto ? "auto" : undefined,
      tickLabelFormatter: (formatAs === "percent"
        ? "auto-percent"
        : "auto-number") as TickLabelFormatterOption,
    },
    content: {
      points: { func: { show: false } },
      bars: {
        func: (info) => {
          const diff = getSpecialBarChartDiff(info);
          if (diff === undefined) {
            return {
              show: true,
              fillColor: _CF_COMPARISON,
              dataLabel: { show: config.s.showDataLabels },
            };
          }
          if (diff > threshold) {
            return {
              show: true,
              fillColor: inverted ? _CF_RED : _CF_GREEN,
              dataLabel: { show: config.s.showDataLabels },
            };
          }
          if (diff < -1 * threshold) {
            return {
              show: true,
              fillColor: inverted ? _CF_GREEN : _CF_RED,
              dataLabel: { show: config.s.showDataLabels },
            };
          }
          return {
            show: true,
            fillColor: _CF_COMPARISON,
            dataLabel: { show: config.s.showDataLabels },
          };
        },
        textFormatter: (info: ChartValueInfo) => {
          const diff = getSpecialBarChartDiff(info);
          const formatter = getFormatterFunc(
            "percent",
            config.s.decimalPlaces ?? 0,
          );
          if (diff === undefined) return "";
          if (diff < -1 * threshold) return formatter(diff);
          if (diff > threshold) return "+" + formatter(diff);
          if (config.s.specialBarChartDataLabels === "all-values")
            return formatter(diff);
          return "";
        },
        stacking: "none",
      },
      lines: { func: { show: false } },
    },
  };
}

function getSpecialBarChartDiff(info: ChartValueInfo) {
  const currentV = info.val;
  if (currentV === undefined) {
    return undefined;
  }
  const prevV = info.seriesValArrays.at(info.i_series)?.[
    // Must use square brackets here (otherwise negative 1 issue)
    info.i_val - 1
  ];
  if (prevV !== undefined && prevV !== 0) {
    return currentV / prevV - 1;
  }
  return undefined;
}
