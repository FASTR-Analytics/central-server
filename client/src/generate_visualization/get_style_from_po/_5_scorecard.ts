import { CustomFigureStyleOptions, TableCellInfo } from "panther";
import {
  _CF_LIGHTER_GREEN,
  _CF_LIGHTER_RED,
  _CF_LIGHTER_YELLOW,
  type DeckStyleContext,
  type IndicatorMetadata,
  PresentationObjectConfig,
} from "platform-lib";
import { getTextStyle, getTableLayoutStyle } from "./_0_common";

function scaleValueForFormat(rawValue: number, formatAs: string): number {
  if (formatAs === "percent") return rawValue * 100;
  if (formatAs === "rate_per_10k") return rawValue * 10000;
  return rawValue;
}

function getScorecardCutoffColor(
  direction: "higher_is_better" | "lower_is_better",
  green: number,
  yellow: number,
  scaledValue: number,
): string {
  if (direction === "higher_is_better") {
    if (scaledValue >= green) return _CF_LIGHTER_GREEN;
    if (scaledValue >= yellow) return _CF_LIGHTER_YELLOW;
    return _CF_LIGHTER_RED;
  } else {
    if (scaledValue <= green) return _CF_LIGHTER_GREEN;
    if (scaledValue <= yellow) return _CF_LIGHTER_YELLOW;
    return _CF_LIGHTER_RED;
  }
}

function formatScorecardValue(
  rawValue: number,
  formatAs: "percent" | "number" | "rate_per_10k",
  decimalPlaces: number,
): string {
  const scaled = scaleValueForFormat(rawValue, formatAs);
  const formatted = scaled.toFixed(decimalPlaces);
  if (formatAs === "percent") return `${formatted}%`;
  return formatted;
}

export function buildScorecardStyle(
  config: PresentationObjectConfig,
  indicatorMetadata: IndicatorMetadata[],
  deckStyle?: DeckStyleContext,
): CustomFigureStyleOptions {
  const metadataById = new Map(indicatorMetadata.map((m) => [m.id, m]));

  return {
    text: getTextStyle(config, deckStyle),
    surrounds: { legendPosition: config.s.hideLegend ? "none" : undefined },
    grid: { showGrid: false },
    content: {
      tableCells: {
        func: (info: TableCellInfo) => {
          const meta =
            metadataById.get(info.colHeader?.id ?? "") ??
            metadataById.get(info.rowHeader?.id ?? "");
          if (meta?.threshold_direction && info.valueAsNumber !== undefined) {
            const scaled = scaleValueForFormat(
              info.valueAsNumber,
              meta.format_as ?? "number",
            );
            return {
              backgroundColor: getScorecardCutoffColor(
                meta.threshold_direction as "higher_is_better" | "lower_is_better",
                meta.threshold_green ?? 0,
                meta.threshold_yellow ?? 0,
                scaled,
              ),
              textColorStrategy: {
                ifLight: { key: "baseContent" as const },
                ifDark: { key: "base100" as const },
              },
            };
          }
          return { backgroundColor: "none" };
        },
        textFormatter: (info: TableCellInfo) => {
          const meta =
            metadataById.get(info.colHeader?.id ?? "") ??
            metadataById.get(info.rowHeader?.id ?? "");
          if (meta?.format_as && info.valueAsNumber !== undefined) {
            return formatScorecardValue(
              info.valueAsNumber,
              meta.format_as as "percent" | "number" | "rate_per_10k",
              meta.decimal_places ?? 0,
            );
          }
          return String(info.value);
        },
      },
    },
    table: getTableLayoutStyle(config),
  };
}
