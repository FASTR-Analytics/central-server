import { CustomFigureStyleOptions } from "panther";
import { type DeckStyleContext, type IndicatorMetadata, PresentationObjectConfig } from "platform-lib";
import { buildStandardStyle } from "./get_style_from_po/_1_standard";
import { buildCoverageChartStyle } from "./get_style_from_po/_2_coverage";
import { buildPercentChangeChartStyle } from "./get_style_from_po/_3_percent_change";
import { buildDisruptionsChartStyle } from "./get_style_from_po/_4_disruptions";
import { buildScorecardStyle } from "./get_style_from_po/_5_scorecard";
import {
  isSpecialBarChartActive,
  isSpecialCoverageChartActive,
  isSpecialDisruptionsChartActive,
  isSpecialScorecardTableActive,
} from "./special_chart_checks";

export function getStyleFromPresentationObject(
  config: PresentationObjectConfig,
  formatAs: "percent" | "number",
  deckStyle?: DeckStyleContext,
  indicatorMetadata?: IndicatorMetadata[],
): CustomFigureStyleOptions {
  if (isSpecialScorecardTableActive(config) && indicatorMetadata) {
    return buildScorecardStyle(config, indicatorMetadata, deckStyle);
  }
  if (isSpecialCoverageChartActive(config)) {
    return buildCoverageChartStyle(config, formatAs, deckStyle);
  }
  if (isSpecialBarChartActive(config)) {
    return buildPercentChangeChartStyle(config, formatAs, deckStyle);
  }
  if (isSpecialDisruptionsChartActive(config)) {
    return buildDisruptionsChartStyle(config, formatAs, deckStyle);
  }
  return buildStandardStyle(config, formatAs, deckStyle);
}
