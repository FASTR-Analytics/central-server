import {
  type ConditionalFormatting,
  type ConditionalFormattingScale,
  type ConditionalFormattingThresholds,
  LEGACY_CF_PRESET_IDS,
  LEGACY_CF_PRESETS,
  type LegacyCfPresetId,
  deriveBucketLabels,
  t3,
} from "platform-lib";
import {
  buildAutoFormatter,
  Button,
  ButtonGroup,
  Checkbox,
  ColorPicker,
  type ColorKeyOrString,
  type ContinuousScaleConfig,
  NumberInput,
  PercentSelect,
  RadioGroup,
  Select,
  type SelectOption,
  Slider,
} from "panther";
import { For, Show } from "solid-js";
import { StyleRevealGroup } from "./presentation_object_editor_panel_style/_style_components";

type Props = {
  value: ConditionalFormatting | undefined;
  onChange: (v: ConditionalFormatting) => void;
  formatAs: "percent" | "number";
  decimalPlaces: number;
  allowNegative?: boolean;
};

type Mode = "none" | "scale" | "thresholds";

const NO_DATA_DEFAULT_THRESHOLDS = "#ffffff";
const NO_DATA_DEFAULT_SCALE = "#f0f0f0";

export function ConditionalFormattingEditor(p: Props) {
  const cf = (): ConditionalFormatting => p.value ?? { type: "none" };

  const handleModeChange = (mode: Mode | undefined) => {
    if (!mode || mode === "none") {
      p.onChange({ type: "none" });
      return;
    }
    if (mode === "scale") {
      p.onChange(cf().type === "scale" ? cf() : defaultScaleCf());
      return;
    }
    p.onChange(cf().type === "thresholds" ? cf() : defaultThresholdsCf());
  };

  return (
    <div class="ui-spy-sm">
      <ButtonGroup<Mode>
        items={[
          { id: "none", label: "Off" },
          { id: "scale", label: "Scale" },
          { id: "thresholds", label: "Thresholds" },
        ]}
        value={cf().type}
        onChange={handleModeChange}
        size="sm"
      />
      <Show when={cf().type === "scale"}>
        <ScalePanel
          cf={cf() as ConditionalFormattingScale}
          onChange={p.onChange}
          formatAs={p.formatAs}
          allowNegative={p.allowNegative}
        />
      </Show>
      <Show when={cf().type === "thresholds"}>
        <ThresholdsPanel
          cf={cf() as ConditionalFormattingThresholds}
          onChange={p.onChange}
          formatAs={p.formatAs}
          decimalPlaces={p.decimalPlaces}
          allowNegative={p.allowNegative}
        />
      </Show>
    </div>
  );
}

const PALETTE_OPTIONS: { value: string; label: string }[] = [
  { value: "rd-yl-gn", label: "Red → Yellow → Green" },
  { value: "rd-gn-muted", label: "Red → Green (muted)" },
  { value: "rd-bu", label: "Red → Blue" },
  { value: "spectral", label: "Spectral" },
  { value: "blues", label: "Blues" },
  { value: "greens", label: "Greens" },
  { value: "reds", label: "Reds" },
  { value: "oranges", label: "Oranges" },
  { value: "purples", label: "Purples" },
  { value: "viridis", label: "Viridis" },
  { value: "plasma", label: "Plasma" },
  { value: "inferno", label: "Inferno" },
  { value: "turbo", label: "Turbo" },
];

const CUSTOM_PALETTE = "__custom__";

function ScalePanel(p: {
  cf: ConditionalFormattingScale;
  onChange: (v: ConditionalFormatting) => void;
  formatAs: "percent" | "number";
  allowNegative?: boolean;
}) {
  const state = () => parseScale(p.cf.scale);

  const update = (patch: Partial<ConditionalFormattingScale>) => {
    p.onChange({ ...p.cf, ...patch });
  };

  const updateScale = (patch: Partial<ScaleEditorState>) => {
    const next = { ...state(), ...patch };
    update({ scale: serializeScale(next) });
  };

  const isDiscrete = () => (p.cf.steps ?? 0) >= 2;
  const isFixed = () => p.cf.domain.kind === "fixed";
  const hasMid = () => state().mid !== undefined;

  return (
    <StyleRevealGroup>
      <Select
        label="Palette"
        value={
          state().mode === "custom"
            ? CUSTOM_PALETTE
            : (state().paletteName ?? "rd-yl-gn")
        }
        options={[
          ...PALETTE_OPTIONS,
          { value: CUSTOM_PALETTE, label: "Custom" },
        ]}
        onChange={(v) => {
          if (v === CUSTOM_PALETTE) {
            updateScale({ mode: "custom", from: "#fee0d2", to: "#de2d26", mid: undefined });
          } else {
            updateScale({ mode: "preset", paletteName: v });
          }
        }}
        fullWidth
      />
      <Show when={state().mode === "custom"}>
        <div class="flex flex-wrap items-end gap-3">
          <ColorPicker
            label="From"
            value={colorToString(state().from ?? "#fee0d2")}
            onChange={(v) => updateScale({ from: v })}
            colorSet="standard"
          />
          <Show when={hasMid()}>
            <ColorPicker
              label="Mid"
              value={colorToString(state().mid ?? "#ffffff")}
              onChange={(v) => updateScale({ mid: v })}
              colorSet="standard"
            />
          </Show>
          <ColorPicker
            label="To"
            value={colorToString(state().to ?? "#de2d26")}
            onChange={(v) => updateScale({ to: v })}
            colorSet="standard"
          />
          <Checkbox
            label="Diverging (mid)"
            checked={hasMid()}
            onChange={(v) => updateScale({ mid: v ? "#ffffff" : undefined })}
          />
        </div>
      </Show>
      <Checkbox
        label="Reverse"
        checked={state().reverse}
        onChange={(v) => updateScale({ reverse: v })}
      />
      <RadioGroup<"continuous" | "discrete">
        label="Scale type"
        options={[
          { value: "continuous", label: "Continuous" },
          { value: "discrete", label: "Discrete" },
        ]}
        value={isDiscrete() ? "discrete" : "continuous"}
        onChange={(v) =>
          update({ steps: v === "discrete" ? (p.cf.steps ?? 5) : undefined })
        }
        horizontal
      />
      <Show when={isDiscrete()}>
        <Slider
          label="Number of steps"
          min={2}
          max={10}
          step={1}
          value={p.cf.steps ?? 5}
          onChange={(v) => update({ steps: v })}
          fullWidth
          showValueInLabel
        />
      </Show>
      <div class="ui-spy-sm">
        <Checkbox
          label="Fix value range"
          checked={isFixed()}
          onChange={(v) =>
            update({
              domain: v ? { kind: "fixed", min: 0, max: 1 } : { kind: "auto" },
            })
          }
        />
        <Show when={isFixed() && p.cf.domain.kind === "fixed"}>
          {(() => {
            const domain = p.cf.domain as {
              kind: "fixed";
              min: number;
              max: number;
              mid?: number;
            };
            return (
              <div class="flex items-center gap-3">
                {p.formatAs === "percent" ? (
                  <PercentSelect
                    label="Min"
                    value={domain.min}
                    onChange={(v) => update({ domain: { ...domain, min: v } })}
                    max={domain.max}
                    allowNegative={p.allowNegative}
                    showPlusPrefix={p.allowNegative}
                  />
                ) : (
                  <NumberInput
                    label="Min"
                    value={domain.min}
                    onChange={(v) => update({ domain: { ...domain, min: v } })}
                    max={domain.max}
                  />
                )}
                {p.formatAs === "percent" ? (
                  <PercentSelect
                    label="Max"
                    value={domain.max}
                    onChange={(v) => update({ domain: { ...domain, max: v } })}
                    min={domain.min}
                    allowNegative={p.allowNegative}
                    showPlusPrefix={p.allowNegative}
                  />
                ) : (
                  <NumberInput
                    label="Max"
                    value={domain.max}
                    onChange={(v) => update({ domain: { ...domain, max: v } })}
                    min={domain.min}
                  />
                )}
              </div>
            );
          })()}
        </Show>
      </div>
    </StyleRevealGroup>
  );
}

const CUSTOM_PRESET_VALUE = "__custom__";

function ThresholdsPanel(p: {
  cf: ConditionalFormattingThresholds;
  onChange: (v: ConditionalFormatting) => void;
  formatAs: "percent" | "number";
  decimalPlaces: number;
  allowNegative?: boolean;
}) {
  const matchedPreset = (): LegacyCfPresetId | undefined => {
    for (const id of LEGACY_CF_PRESET_IDS) {
      if (thresholdsEqual(p.cf, LEGACY_CF_PRESETS[id].value)) return id;
    }
    return undefined;
  };

  const presetOptions = (): SelectOption<string>[] => {
    const matched = matchedPreset();
    const items: SelectOption<string>[] = LEGACY_CF_PRESET_IDS.map((id) => ({
      value: id,
      label: t3(LEGACY_CF_PRESETS[id].label),
    }));
    if (!matched) {
      items.push({ value: CUSTOM_PRESET_VALUE, label: "Custom" });
    }
    return items;
  };

  const applyPreset = (id: string) => {
    if (id === CUSTOM_PRESET_VALUE) return;
    const preset = LEGACY_CF_PRESETS[id as LegacyCfPresetId];
    if (preset) p.onChange(preset.value);
  };

  const update = (patch: Partial<ConditionalFormattingThresholds>) => {
    p.onChange({ ...p.cf, ...patch });
  };

  const setCutoff = (i: number, v: number) => {
    const cutoffs = [...p.cf.cutoffs];
    const lowerBound = i > 0 ? cutoffs[i - 1] : Number.NEGATIVE_INFINITY;
    const upperBound =
      i < cutoffs.length - 1 ? cutoffs[i + 1] : Number.POSITIVE_INFINITY;
    cutoffs[i] = Math.max(lowerBound, Math.min(upperBound, v));
    update({ cutoffs });
  };

  const setBucketColor = (i: number, color: string) => {
    const buckets = p.cf.buckets.map((b, j) => (j === i ? { ...b, color } : b));
    update({ buckets });
  };

  const addRow = () => {
    const last = p.cf.cutoffs.at(-1) ?? 0;
    const next = last + (last === 0 ? 0.1 : Math.abs(last) * 0.5);
    update({
      cutoffs: [...p.cf.cutoffs, next],
      buckets: [
        ...p.cf.buckets,
        { color: p.cf.buckets.at(-1)?.color ?? "#cccccc" },
      ],
    });
  };

  const removeRow = (i: number) => {
    if (p.cf.buckets.length <= 2) return;
    const cutoffIndex = i === p.cf.buckets.length - 1 ? i - 1 : i;
    const nextBuckets = p.cf.buckets.filter((_, j) => j !== i);
    const nextCutoffs = p.cf.cutoffs.filter((_, j) => j !== cutoffIndex);
    update({ buckets: nextBuckets, cutoffs: nextCutoffs });
  };

  const direction = (): "higher-is-better" | "lower-is-better" =>
    p.cf.direction ?? "higher-is-better";

  const labels = () =>
    deriveBucketLabels(
      p.cf.cutoffs,
      buildAutoFormatter(p.cf.cutoffs, p.formatAs),
      direction(),
    );

  return (
    <StyleRevealGroup>
      <Select
        label="Preset"
        value={matchedPreset() ?? CUSTOM_PRESET_VALUE}
        options={presetOptions()}
        onChange={applyPreset}
        fullWidth
      />
      <RadioGroup<"higher-is-better" | "lower-is-better">
        label="Direction"
        options={[
          { value: "higher-is-better", label: "Higher is better" },
          { value: "lower-is-better", label: "Lower is better" },
        ]}
        value={direction()}
        onChange={(v) =>
          update({ direction: v as "higher-is-better" | "lower-is-better" })
        }
        horizontal
      />
      <div class="flex flex-col gap-1.5">
        <For each={p.cf.buckets.slice().reverse()}>
          {(bucket, j) => {
            const origI = () => p.cf.buckets.length - 1 - j();
            const cutoffIdx = () => origI() - 1;
            const minVal = () => cutoffIdx() > 0 ? p.cf.cutoffs[cutoffIdx() - 1] : (p.allowNegative ? -1 : 0);
            const maxVal = () => cutoffIdx() < p.cf.cutoffs.length - 1 ? p.cf.cutoffs[cutoffIdx() + 1] : 1;
            return (
              <div class="flex items-center gap-2">
                <div class="w-24 flex-none">
                  <Show when={origI() > 0}>
                    <div class="translate-y-1/2">
                      <Show when={p.formatAs === "percent"} fallback={
                        <NumberInput
                          value={p.cf.cutoffs[cutoffIdx()]}
                          onChange={(v) => setCutoff(cutoffIdx(), v)}
                          min={minVal()}
                          max={maxVal()}
                        />
                      }>
                        <PercentSelect
                          value={p.cf.cutoffs[cutoffIdx()]}
                          onChange={(v) => setCutoff(cutoffIdx(), v)}
                          min={minVal()}
                          max={maxVal()}
                          allowNegative={p.allowNegative}
                          showPlusPrefix={p.allowNegative}
                        />
                      </Show>
                    </div>
                  </Show>
                </div>
                <ColorPicker
                  value={colorToString(bucket.color)}
                  onChange={(v) => setBucketColor(origI(), v)}
                  colorSet="standard"
                />
                <span class="text-base-content/70 text-xs">
                  {labels()[origI()]}
                </span>
                <Show when={p.cf.buckets.length > 2}>
                  <div class="ml-auto">
                    <Button
                      size="sm"
                      iconName="x"
                      intent="neutral"
                      outline
                      onClick={() => removeRow(origI())}
                    />
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
        <button
          type="button"
          class="ui-hoverable text-base-content/70 hover:text-base-content self-start text-xs underline"
          onClick={addRow}
        >
          + Add cutoff
        </button>
      </div>
    </StyleRevealGroup>
  );
}

function defaultScaleCf(): ConditionalFormattingScale {
  return {
    type: "scale",
    scale: "rd-yl-gn",
    domain: { kind: "auto" },
    noDataColor: NO_DATA_DEFAULT_SCALE,
  };
}

function defaultThresholdsCf(): ConditionalFormattingThresholds {
  return LEGACY_CF_PRESETS["fmt-90-80"].value;
}

type ScaleEditorState = {
  mode: "preset" | "custom";
  paletteName?: string;
  from?: string;
  mid?: string;
  to?: string;
  reverse: boolean;
};

function parseScale(scale: ContinuousScaleConfig): ScaleEditorState {
  if (typeof scale === "string") {
    if (scale.endsWith(":rev")) {
      return { mode: "preset", paletteName: scale.slice(0, -4), reverse: true };
    }
    return { mode: "preset", paletteName: scale, reverse: false };
  }
  if (Array.isArray(scale)) {
    return {
      mode: "custom",
      from: colorToString(scale[0] ?? "#fee0d2"),
      to: colorToString(scale[scale.length - 1] ?? "#de2d26"),
      reverse: false,
    };
  }
  if ("palette" in scale) {
    return { mode: "preset", paletteName: scale.palette, reverse: scale.reverse ?? false };
  }
  if ("mid" in scale) {
    return {
      mode: "custom",
      from: colorToString(scale.min),
      mid: colorToString(scale.mid),
      to: colorToString(scale.max),
      reverse: scale.reverse ?? false,
    };
  }
  return {
    mode: "custom",
    from: colorToString(scale.min),
    to: colorToString(scale.max),
    reverse: scale.reverse ?? false,
  };
}

function serializeScale(state: ScaleEditorState): ContinuousScaleConfig {
  if (state.mode === "preset") {
    const name = state.paletteName ?? "rd-yl-gn";
    return { palette: name as never, reverse: state.reverse };
  }
  if (state.mid !== undefined) {
    return { min: state.from ?? "#fee0d2", mid: state.mid, max: state.to ?? "#de2d26", reverse: state.reverse };
  }
  return { min: state.from ?? "#fee0d2", max: state.to ?? "#de2d26", reverse: state.reverse };
}

function colorToString(c: ColorKeyOrString): string {
  if (typeof c === "string") return c;
  return "#cccccc";
}

function thresholdsEqual(
  a: ConditionalFormattingThresholds,
  b: ConditionalFormattingThresholds,
): boolean {
  if (a.cutoffs.length !== b.cutoffs.length) return false;
  if (a.buckets.length !== b.buckets.length) return false;
  for (let i = 0; i < a.cutoffs.length; i++) {
    if (a.cutoffs[i] !== b.cutoffs[i]) return false;
  }
  for (let i = 0; i < a.buckets.length; i++) {
    if (JSON.stringify(a.buckets[i].color) !== JSON.stringify(b.buckets[i].color)) {
      return false;
    }
  }
  return true;
}
