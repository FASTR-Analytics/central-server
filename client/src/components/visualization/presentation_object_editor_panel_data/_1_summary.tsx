import {
  DisaggregationDisplayOption,
  DisaggregationOption,
  PresentationObjectConfig,
  PresentationObjectDetail,
  PresentationOption,
  ResultsValue,
  VIZ_TYPE_CONFIG,
  convertVisualizationType,
  get_PRESENTATION_SELECT_OPTIONS,
} from "platform-lib";
import { Select } from "panther";
import { batch } from "solid-js";
import { SetStoreFunction } from "solid-js/store";

type DataValuesSummaryProps = {
  poDetail: PresentationObjectDetail;
};

export function DataValuesSummary(p: DataValuesSummaryProps) {
  return (
    <div class="">
      <div class="text-md font-700 pb-1">Metric</div>
      <div class="text-sm">{p.poDetail.resultsValue.label}</div>
    </div>
  );
}

type TypeSpecificCache = {
  valuesDisDisplayOpt: DisaggregationDisplayOption;
  disaggregateBy: { disOpt: DisaggregationOption; disDisplayOpt: DisaggregationDisplayOption }[];
  content: PresentationObjectConfig["s"]["content"];
  styleOverrides: Partial<PresentationObjectConfig["s"]>;
};

function extractStyleOverrides(config: PresentationObjectConfig): Partial<PresentationObjectConfig["s"]> {
  const allResetKeys = new Set<string>();
  for (const tc of Object.values(VIZ_TYPE_CONFIG)) {
    for (const key of Object.keys(tc.styleResets)) {
      allResetKeys.add(key);
    }
  }
  const overrides: Record<string, unknown> = {};
  for (const key of allResetKeys) {
    overrides[key] = config.s[key as keyof PresentationObjectConfig["s"]];
  }
  return overrides as Partial<PresentationObjectConfig["s"]>;
}

type PresentationTypeSummaryProps = {
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
  disaggregationOptions: ResultsValue["disaggregationOptions"];
};

export function PresentationTypeSummary(p: PresentationTypeSummaryProps) {
  const cache = new Map<PresentationOption, TypeSpecificCache>();

  const allowedTypes = get_PRESENTATION_SELECT_OPTIONS(p.disaggregationOptions);

  return (
    <div class="">
      <div class="text-md font-700 pb-1">Presentation type</div>
      <Select
        options={allowedTypes}
        value={p.tempConfig.d.type}
        onChange={(v) => {
          const newType = v as PresentationOption;
          const currentType = p.tempConfig.d.type;
          if (newType === currentType) return;

          cache.set(currentType, {
            valuesDisDisplayOpt: p.tempConfig.d.valuesDisDisplayOpt,
            disaggregateBy: p.tempConfig.d.disaggregateBy.map((d) => ({ ...d })),
            content: p.tempConfig.s.content,
            styleOverrides: extractStyleOverrides(p.tempConfig),
          });

          const cached = cache.get(newType);
          if (cached) {
            batch(() => {
              p.setTempConfig("d", "type", newType);
              p.setTempConfig("d", "valuesDisDisplayOpt", cached.valuesDisDisplayOpt);
              p.setTempConfig("d", "disaggregateBy", cached.disaggregateBy);
              p.setTempConfig("s", "content", cached.content);
              p.setTempConfig("s", (prev) => ({ ...prev, ...cached.styleOverrides }));
            });
          } else {
            try {
              const converted = convertVisualizationType(
                p.tempConfig,
                newType,
                p.disaggregationOptions,
              );
              batch(() => {
                p.setTempConfig("d", "type", converted.d.type);
                p.setTempConfig("d", "valuesDisDisplayOpt", converted.d.valuesDisDisplayOpt);
                p.setTempConfig("d", "disaggregateBy", converted.d.disaggregateBy);
                p.setTempConfig("s", "content", converted.s.content);
                p.setTempConfig("s", (prev) => ({ ...prev, ...VIZ_TYPE_CONFIG[newType].styleResets }));
              });
            } catch (e) {
              console.error("Failed to convert visualization type:", e);
            }
          }
        }}
        fullWidth
      />
    </div>
  );
}
