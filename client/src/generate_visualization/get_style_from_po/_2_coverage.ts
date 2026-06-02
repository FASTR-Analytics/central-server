import {
  ChartSeriesInfo,
  ChartValueInfo,
  ColorKeyOrString,
  CustomFigureStyleOptions,
  toPct0,
  type TickLabelFormatterOption,
} from "panther";
import { type DeckStyleContext, getCalendar, PresentationObjectConfig } from "platform-lib";
import { getTextStyle } from "./_0_common";

export function buildCoverageChartStyle(
  config: PresentationObjectConfig,
  formatAs: "percent" | "number",
  deckStyle?: DeckStyleContext,
): CustomFigureStyleOptions {
  return {
    seriesColorFunc: getCoverageSeriesColorFunc(),
    text: getTextStyle(config, deckStyle),
    panes: { nCols: config.s.nColsInCellDisplay },
    xPeriodAxis: { calendar: getCalendar() },
    yScaleAxis: {
      max: config.s.forceYMax1 ? 1 : undefined,
      min: config.s.forceYMinAuto ? "auto" : undefined,
      tickLabelFormatter: (formatAs === "percent"
        ? "auto-percent"
        : "auto-number") as TickLabelFormatterOption,
    },
    content: {
      points: {
        func: {
          show: true,
          dataLabel: { show: true },
        },
        textFormatter: (info: ChartValueInfo) => {
          const thisSeries = info.seriesValArrays.at(info.i_series);
          if (!thisSeries) return "";
          let lastGoodIndex = 0;
          for (let i = 0; i < thisSeries.length; i++) {
            if (thisSeries[i] !== undefined) lastGoodIndex = i;
          }
          return info.i_val === lastGoodIndex ? toPct0(info.val) : "";
        },
      },
      bars: { func: { show: false } },
      lines: { func: { show: true } },
    },
  };
}

function getCoverageSeriesColorFunc(): (
  info: ChartSeriesInfo,
) => ColorKeyOrString {
  return (info) => {
    if (info.seriesHeader.label.startsWith("default")) return "#000000";
    if (
      info.seriesHeader.label.startsWith("Survey") ||
      info.seriesHeader.label.startsWith("Estimation basée")
    )
      return "#000000";
    if (
      info.seriesHeader.label.startsWith("Projected") ||
      info.seriesHeader.label.startsWith("Estimation projetée")
    )
      return "#F04D44";
    return "#CED4DB";
  };
}
