import {
  buildAutoFormatter,
  type LegendInput,
  type LegendItem,
  resolveAutoScaleLegend,
  thresholdColorFunc,
  type ValuesColorFunc,
  valuesColorScale,
} from "panther";
import { type ConditionalFormatting, deriveBucketLabels } from "platform-lib";

export function compileCfToValuesColorFunc(
  cf: ConditionalFormatting,
): ValuesColorFunc | undefined {
  switch (cf.type) {
    case "none":
      return undefined;
    case "scale": {
      const base = valuesColorScale(cf.scale, {
        steps: cf.steps,
        noDataColor: cf.noDataColor,
      });
      if (cf.domain.kind === "auto") return base;
      const { min, max } = cf.domain;
      return (value, _liveMin, _liveMax) => base(value, min, max);
    }
    case "thresholds":
      return thresholdColorFunc(
        cf.cutoffs,
        cf.buckets.map((b) => b.color),
        cf.noDataColor,
      );
  }
}

export function compileCfToLegend(
  cf: ConditionalFormatting,
  formatAs: "percent" | "number",
): LegendInput | undefined {
  switch (cf.type) {
    case "none":
      return undefined;
    case "scale": {
      if (cf.domain.kind !== "fixed") return undefined;
      const domain = cf.domain;

      const colorFunc = valuesColorScale(cf.scale, {
        steps: cf.steps,
        noDataColor: cf.noDataColor,
      });

      const isDiscrete = (cf.steps ?? 0) >= 2;
      const autoConfig = isDiscrete
        ? {
            type: "stepped-auto" as const,
            nSteps: cf.steps!,
            domain,
            format: formatAs,
          }
        : {
            type: "gradient-auto" as const,
            domain,
            format: formatAs,
          };

      return resolveAutoScaleLegend(autoConfig, colorFunc, domain);
    }
    case "thresholds": {
      const fmt = buildAutoFormatter(cf.cutoffs, formatAs);
      const labels = deriveBucketLabels(cf.cutoffs, fmt, cf.direction);
      return cf.buckets
        .map((bucket, i) => ({
          label: labels[i],
          color: bucket.color,
        }))
        .reverse();
    }
  }
}
