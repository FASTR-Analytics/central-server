import {
  DisaggregationDisplayOption,
  DisaggregationOption,
  IneffectiveDisaggregator,
  IneffectiveReason,
  PresentationObjectConfig,
  PresentationObjectDetail,
  ResultsValue,
  getDisaggregationLabel,
  getNextAvailableDisaggregationDisplayOption,
  getRollupLabelContext,
  get_DISAGGREGATION_DISPLAY_OPTIONS,
} from "platform-lib";
import { Checkbox, RadioGroup, Select } from "panther";
import { For, Match, Show, Switch } from "solid-js";
import { SetStoreFunction } from "solid-js/store";

type DisaggregationSectionProps = {
  poDetail: PresentationObjectDetail;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
  allDisaggregationOptions: ResultsValue["disaggregationOptions"];
  ineffectiveDisaggregators: IneffectiveDisaggregator[];
  effectiveValueProps: string[];
  hasMultipleValueProps: boolean;
};

export function DisaggregationSection(p: DisaggregationSectionProps) {
  const hasValuesFilter = () =>
    !!p.tempConfig.d.valuesFilter && p.tempConfig.d.valuesFilter.length > 0;

  return (
    <div class="ui-spy-sm">
      <div class="text-md font-700">Display (disaggregate)</div>

      <Show when={p.poDetail.resultsValue.valueProps.length > 1}>
        <Show
          when={p.hasMultipleValueProps}
          fallback={
            <div class="pb-4">
              <Checkbox
                label="Data values"
                checked={true}
                disabled={true}
                onChange={() => {}}
              />
              <Show when={hasValuesFilter()}>
                <span class="text-warning pl-7 text-xs">
                  Disabled (filtered to single value)
                </span>
              </Show>
            </div>
          }
        >
          <DataValuesDisaggregation
            tempConfig={p.tempConfig}
            setTempConfig={p.setTempConfig}
          />
        </Show>
      </Show>

      <For each={p.allDisaggregationOptions}>
        {(disOpt) => (
          <DisaggregationOptionRow
            disOpt={disOpt}
            poDetail={p.poDetail}
            tempConfig={p.tempConfig}
            setTempConfig={p.setTempConfig}
            ineffectiveDisaggregators={p.ineffectiveDisaggregators}
            effectiveValueProps={p.effectiveValueProps}
          />
        )}
      </For>
    </div>
  );
}

type DataValuesDisaggregationProps = {
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
};

function DataValuesDisaggregation(p: DataValuesDisaggregationProps) {
  return (
    <div class="ui-spy-sm pb-4">
      <Checkbox
        label={
          <>
            <div class="flex flex-wrap items-center gap-x-1">
              <span class="">Data values</span>
              <span class="text-xs">(Required for this visualization)</span>
            </div>
          </>
        }
        checked={true}
        onChange={() => {}}
        disabled={true}
      />
      <Select
        options={get_DISAGGREGATION_DISPLAY_OPTIONS()[
          p.tempConfig.d.type
        ].filter((opt) => opt.value !== "replicant" && opt.value !== "mapArea")}
        value={p.tempConfig.d.valuesDisDisplayOpt}
        onChange={(v) =>
          p.setTempConfig(
            "d",
            "valuesDisDisplayOpt",
            v as DisaggregationDisplayOption,
          )
        }
        fullWidth
      />
    </div>
  );
}

type DisaggregationOptionRowProps = {
  disOpt: DisaggregationSectionProps["allDisaggregationOptions"][number];
  poDetail: PresentationObjectDetail;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
  ineffectiveDisaggregators: IneffectiveDisaggregator[];
  effectiveValueProps: string[];
};

function getReasonMessage(reason: IneffectiveReason): string {
  switch (reason) {
    case "filtered_to_one_value":
      return "Disabled (filtered to single value)";
    case "single_period":
      return "Disabled (single period)";
    case "single_year":
      return "Disabled (single year)";
  }
}

function getDisplayDisaggregationLabel(disOpt: DisaggregationOption): string {
  if ((disOpt as string) === "admin_area_1") return "Country";
  return getDisaggregationLabel(disOpt, {}).en;
}

function DisaggregationOptionRow(p: DisaggregationOptionRowProps) {
  const ineffective = () =>
    p.ineffectiveDisaggregators.find((d) => d.disOpt === p.disOpt.value);

  return (
    <Switch>
      <Match when={ineffective()} keyed>
        {(ineff) => (
          <div class="">
            <Checkbox
              label={getDisplayDisaggregationLabel(p.disOpt.value)}
              checked={false}
              disabled={true}
              onChange={() => {}}
            />
            <div class="text-warning pl-7 text-xs">
              {getReasonMessage(ineff.reason)}
            </div>
          </div>
        )}
      </Match>
      <Match when={!p.disOpt.isRequired}>
        <div class="ui-spy-sm">
          <Checkbox
            label={getDisplayDisaggregationLabel(p.disOpt.value)}
            checked={p.tempConfig.d.disaggregateBy.some(
              (d) => d.disOpt === p.disOpt.value,
            )}
            onChange={(checked) => {
              if (checked) {
                const disDisplayOpt =
                  getNextAvailableDisaggregationDisplayOption(
                    p.poDetail.resultsValue,
                    p.tempConfig,
                    p.disOpt.value,
                    p.effectiveValueProps,
                  );
                p.setTempConfig("d", "disaggregateBy", (prev) => [
                  ...prev,
                  { disOpt: p.disOpt.value, disDisplayOpt },
                ]);
                p.setTempConfig("d", "selectedReplicantValue", undefined);
              } else {
                p.setTempConfig("d", "disaggregateBy", (prev) =>
                  prev.filter((d) => d.disOpt !== p.disOpt.value),
                );
                p.setTempConfig("d", "selectedReplicantValue", undefined);
              }
            }}
          />
          <Show
            when={p.tempConfig.d.disaggregateBy.find(
              (d) => d.disOpt === p.disOpt.value,
            )}
            keyed
          >
            {(keyedDis) => {
              return (
                <DisaggregationOptionSettings
                  disOpt={p.disOpt}
                  keyedDis={keyedDis}
                  tempConfig={p.tempConfig}
                  setTempConfig={p.setTempConfig}
                />
              );
            }}
          </Show>
        </div>
      </Match>
      <Match when={p.disOpt.isRequired}>
        <div class="ui-spy-sm">
          <Checkbox
            label={
              <div class="flex flex-wrap items-center gap-x-1">
                <span class="">{getDisplayDisaggregationLabel(p.disOpt.value)}</span>
                <span class="text-xs">(Required for this visualization)</span>
              </div>
            }
            checked={true}
            onChange={() => {}}
            disabled={true}
          />
          <Show
            when={p.tempConfig.d.disaggregateBy.find(
              (d) => d.disOpt === p.disOpt.value,
            )}
            fallback={
              <div class="text-danger">Error with required disaggregator</div>
            }
            keyed
          >
            {(keyedDis) => {
              return (
                <DisaggregationOptionSettings
                  disOpt={p.disOpt}
                  keyedDis={keyedDis}
                  tempConfig={p.tempConfig}
                  setTempConfig={p.setTempConfig}
                />
              );
            }}
          </Show>
        </div>
      </Match>
    </Switch>
  );
}

type DisaggregationOptionSettingsProps = {
  disOpt: any;
  keyedDis: any;
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
};

function DisaggregationOptionSettings(p: DisaggregationOptionSettingsProps) {
  return (
    <div class="ui-spy-sm pb-4">
      <Select
        options={get_DISAGGREGATION_DISPLAY_OPTIONS()[p.tempConfig.d.type]}
        value={p.keyedDis.disDisplayOpt}
        onChange={(v) => {
          p.setTempConfig(
            "d",
            "disaggregateBy",
            (d) => d.disOpt === p.keyedDis.disOpt,
            "disDisplayOpt",
            v as DisaggregationDisplayOption,
          );
          p.setTempConfig("d", "selectedReplicantValue", undefined);
        }}
        fullWidth
      />
      <Show
        when={
          p.disOpt.value === "admin_area_2" &&
          p.keyedDis.disDisplayOpt !== "replicant" &&
          p.keyedDis.disDisplayOpt !== "mapArea"
        }
      >
        <AdminAreaOptions
          tempConfig={p.tempConfig}
          setTempConfig={p.setTempConfig}
        />
      </Show>
    </div>
  );
}

type AdminAreaOptionsProps = {
  tempConfig: PresentationObjectConfig;
  setTempConfig: SetStoreFunction<PresentationObjectConfig>;
};

function AdminAreaOptions(p: AdminAreaOptionsProps) {
  // The checkbox label mirrors what the roll-up row will actually contain —
  // getRollupLabelContext is the same helper that labels the rendered row.
  // Pinned names the LEVEL, not the pinned value, because with a replicant the
  // value differs per replicant.
  const rollupCheckboxLabel = () => {
    const ctx = getRollupLabelContext(p.tempConfig);
    if (ctx?.kind === "subset") {
      return "Include results for all selected areas";
    }
    if (ctx?.kind === "pinned") {
      const name = getDisplayDisaggregationLabel(ctx.level);
      return `Include ${name} results`;
    }
    return "Include National results";
  };
  return (
    <div class="flex flex-col items-end">
      <Checkbox
        label={rollupCheckboxLabel()}
        checked={!!p.tempConfig.d.includeAdminAreaRollup}
        onChange={(v) => {
          p.setTempConfig("d", "includeAdminAreaRollup", v);
          if (v && !p.tempConfig.d.adminAreaRollupPosition) {
            p.setTempConfig("d", "adminAreaRollupPosition", "bottom");
          }
        }}
      />
      <Show when={p.tempConfig.d.includeAdminAreaRollup}>
        <div class="flex justify-end pt-1.5 text-sm">
          <RadioGroup
            value={p.tempConfig.d.adminAreaRollupPosition ?? "bottom"}
            options={[
              { value: "top", label: "Top" },
              { value: "bottom", label: "Bottom" },
            ]}
            horizontal
            onChange={(v) =>
              p.setTempConfig(
                "d",
                "adminAreaRollupPosition",
                v as "bottom" | "top",
              )
            }
          />
        </div>
      </Show>
    </div>
  );
}
