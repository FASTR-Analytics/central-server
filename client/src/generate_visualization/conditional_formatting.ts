import { type LegendInput, type LegendItem, type ColorKeyOrString } from "panther";
import {
  _CF_GREEN,
  _CF_LIGHTER_GREEN,
  _CF_LIGHTER_RED,
  _CF_LIGHTER_YELLOW,
  _CF_RED,
  PeriodOption,
  PresentationObjectConfig,
  selectCf,
  t3,
  TranslatableString,
} from "platform-lib";
import { compileCfToLegend } from "./conditional_formatting/compile";
import {
  isSpecialBarChartActive,
  isSpecialCoverageChartActive,
  isSpecialDisruptionsChartActive,
  isSpecialScorecardTableActive,
} from "./special_chart_checks";

function getPeriodChangeLabels(
  timeseriesGrouping: PeriodOption,
  _inverted: boolean,
): { increase: string; decrease: string } {
  const labels = getPeriodChangeTranslatableStrings(timeseriesGrouping);
  return {
    increase: t3(labels.increase),
    decrease: t3(labels.decrease),
  };
}

function getPeriodChangeTranslatableStrings(
  timeseriesGrouping: PeriodOption,
): {
  increase: TranslatableString;
  decrease: TranslatableString;
} {
  switch (timeseriesGrouping) {
    case "period_id":
      return {
        increase: {
          en: "Greater than 10% month-to-month increase",
          fr: "Augmentation de plus de 10% d'un mois à l'autre",
        },
        decrease: {
          en: "Greater than 10% month-to-month decrease",
          fr: "Diminution de plus de 10% d'un mois à l'autre",
        },
      };
    case "quarter_id":
      return {
        increase: {
          en: "Greater than 10% quarter-to-quarter increase",
          fr: "Augmentation de plus de 10% d'un trimestre à l'autre",
        },
        decrease: {
          en: "Greater than 10% quarter-to-quarter decrease",
          fr: "Diminution de plus de 10% d'un trimestre à l'autre",
        },
      };
    case "year":
      return {
        increase: {
          en: "Greater than 10% year-on-year increase",
          fr: "Augmentation de plus de 10% d'une année sur l'autre",
        },
        decrease: {
          en: "Greater than 10% year-on-year decrease",
          fr: "Diminution de plus de 10% d'une année sur l'autre",
        },
      };
  }
}

export function getLegendFromConfig(
  config: PresentationObjectConfig,
  formatAs: "percent" | "number",
): LegendInput | undefined {
  if (isSpecialScorecardTableActive(config)) {
    return [
      { label: t3({ en: "On track", fr: "En bonne voie" }), color: _CF_LIGHTER_GREEN },
      { label: t3({ en: "Progress needed", fr: "Progrès nécessaire" }), color: _CF_LIGHTER_YELLOW },
      { label: t3({ en: "Not on track", fr: "Pas en bonne voie" }), color: _CF_LIGHTER_RED },
    ];
  }
  if (isSpecialCoverageChartActive(config)) {
    return [
      {
        label: t3({
          en: "Administrative data",
          fr: "Données administratives",
        }),
        color: "#CED4DB",
        pointStyle: "as-line",
      },
      {
        label: t3({
          en: "Survey-based estimate",
          fr: "Estimation basée sur des enquêtes",
        }),
        color: "#000000",
        pointStyle: "as-line",
      },
      {
        label: t3({
          en: "Projected estimate",
          fr: "Estimation projetée",
        }),
        color: "#F04D44",
        pointStyle: "as-line",
      },
    ];
  }
  if (isSpecialBarChartActive(config)) {
    if (!config.d.timeseriesGrouping) return undefined;
    const labels = getPeriodChangeLabels(
      config.d.timeseriesGrouping,
      config.s.specialBarChartInverted,
    );
    if (config.s.specialBarChartInverted) {
      return [
        { label: labels.increase, color: _CF_RED },
        { label: labels.decrease, color: _CF_GREEN },
      ];
    }
    return [
      { label: labels.increase, color: _CF_GREEN },
      { label: labels.decrease, color: _CF_RED },
    ];
  }
  if (isSpecialDisruptionsChartActive(config)) {
    if (config.s.diffInverted) {
      return [
        { label: t3({ en: "Actual", fr: "Réel" }), color: "#000000", pointStyle: "as-line" },
        {
          label: t3({ en: "Expected", fr: "Attendu" }),
          color: "#000000",
          pointStyle: "as-line",
          lineDash: "dashed",
          lineStrokeWidthScaleFactor: 0.5,
        },
        { label: t3({ en: "Excess", fr: "Excès" }), color: _CF_RED },
        { label: t3({ en: "Reduction", fr: "Réduction" }), color: _CF_GREEN },
      ];
    }
    return [
      { label: t3({ en: "Actual", fr: "Réel" }), color: "#000000", pointStyle: "as-line" },
      {
        label: t3({ en: "Expected", fr: "Attendu" }),
        color: "#000000",
        pointStyle: "as-line",
        lineDash: "dashed",
        lineStrokeWidthScaleFactor: 0.5,
      },
      { label: t3({ en: "Surplus", fr: "Excédent" }), color: _CF_GREEN },
      { label: t3({ en: "Disruption", fr: "Perturbation" }), color: _CF_RED },
    ];
  }
  const cf = selectCf(config.s);
  if (cf.type === "none") return undefined;
  return compileCfToLegend(cf, formatAs);
}

// Internal helpers still used by conditional_formatting_scorecard.ts for
// hardcoded scorecard cell coloring. These are NOT part of the user-facing
// CF system and do not participate in the ConditionalFormatting union.
export function getCutoffColorFunc(
  c1: number,
  c2: number,
  v: number | string | undefined | null,
  alternativeMidColor?: ColorKeyOrString,
) {
  if (v === ".") return "#ffffff";
  const goodNum = Number(v);
  if (isNaN(goodNum)) return "#ffffff";
  if (goodNum < c2) return _CF_LIGHTER_RED;
  if (goodNum < c1) return alternativeMidColor ?? _CF_LIGHTER_YELLOW;
  return _CF_LIGHTER_GREEN;
}

export function getCutoffColorFuncReverse(
  c1: number,
  c2: number,
  v: number | string | undefined | null,
) {
  if (v === ".") return "#ffffff";
  const goodNum = Number(v);
  if (isNaN(goodNum)) return "#ffffff";
  if (goodNum >= c2) return _CF_LIGHTER_RED;
  if (goodNum >= c1) return _CF_LIGHTER_YELLOW;
  return _CF_LIGHTER_GREEN;
}
