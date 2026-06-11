import { createSignal, For, Show } from "solid-js";
import { getColorPresets, validateBrandColor, type ColorPreset } from "@timroberton/panther";
import type { ColorTheme, AllPresetId } from "platform-lib";
import { BRAND_PRESETS } from "platform-lib";
import type { BrandPresetId } from "platform-lib";

type ColorThemePickerProps = {
  value: ColorTheme;
  onChange: (theme: ColorTheme) => void;
};

function normalizeHex(input: string): string {
  const stripped = input.trim().replace(/^#/, "");
  if (/^[0-9A-Fa-f]{6}$/.test(stripped)) return `#${stripped}`;
  if (/^[0-9A-Fa-f]{3}$/.test(stripped)) return `#${stripped}`;
  return input;
}

export function ColorThemePicker(p: ColorThemePickerProps) {
  // "custom" is the synthetic brand-color preset, never a picker swatch
  const corePresets = getColorPresets().filter(
    (cp): cp is ColorPreset & { id: Exclude<ColorPreset["id"], "custom"> } =>
      cp.id !== "custom",
  );
  const [customHex, setCustomHex] = createSignal(p.value.type === "custom" ? p.value.primary : "");
  const [showCustomInput, setShowCustomInput] = createSignal(false);

  const isCustomActive = () => p.value.type === "custom";
  const customColor = () => (p.value.type === "custom" ? p.value.primary : null);
  const validation = () => {
    const hex = customHex();
    if (!hex) return { valid: false, reason: "Enter a hex color" } as const;
    return validateBrandColor(normalizeHex(hex));
  };
  const isPresetSelected = (id: AllPresetId) => p.value.type === "preset" && p.value.id === id;

  function selectPreset(id: AllPresetId) {
    p.onChange({ type: "preset", id });
    setShowCustomInput(false);
  }

  function clickCustomSwatch() {
    setShowCustomInput(true);
    if (customColor()) setCustomHex(customColor()!);
    else p.onChange({ type: "custom", primary: "" });
  }

  function applyCustom() {
    const hex = normalizeHex(customHex());
    setCustomHex(hex);
    p.onChange({ type: "custom", primary: hex });
  }

  function CheckIcon() {
    return (
      <svg class="h-4 w-4 text-white drop-shadow" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
      </svg>
    );
  }

  function PresetSwatch(props: { preset: ColorPreset; id: AllPresetId }) {
    return (
      <button
        type="button"
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded border transition-transform hover:scale-110"
        classList={{
          "border-base-content/20": isPresetSelected(props.id),
          "border-transparent hover:border-base-300": !isPresetSelected(props.id),
        }}
        style={{ background: props.preset.swatch }}
        onClick={() => selectPreset(props.id)}
        title={props.preset.name}
      >
        <Show when={isPresetSelected(props.id)}><CheckIcon /></Show>
      </button>
    );
  }

  return (
    <div>
      <div class="ui-label">Color theme</div>
      <div class="ui-spy-sm">
        <div>
          <div class="text-neutral mb-1 text-xs">Standard colors</div>
          <div class="flex flex-wrap gap-1.5">
            <For each={corePresets}>{(preset) => <PresetSwatch preset={preset} id={preset.id} />}</For>
          </div>
        </div>
        <Show when={BRAND_PRESETS.length > 0}>
          <div>
            <div class="text-neutral mb-1 text-xs">Special colors</div>
            <div class="flex flex-wrap gap-1.5">
              <For each={BRAND_PRESETS}>{(preset) => <PresetSwatch preset={preset} id={preset.id as BrandPresetId} />}</For>
            </div>
          </div>
        </Show>
        <div>
          <div class="text-neutral mb-1 text-xs">Custom</div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="flex h-7 w-7 cursor-pointer items-center justify-center rounded border transition-transform hover:scale-110"
              classList={{
                "border-base-content/20": isCustomActive(),
                "border-transparent hover:border-base-300": !isCustomActive(),
              }}
              style={{ background: isCustomActive() && validation().valid ? customColor()! : "#e5e5e5" }}
              onClick={clickCustomSwatch}
              title="Custom color"
            >
              <Show when={isCustomActive()}><CheckIcon /></Show>
            </button>
            <Show when={showCustomInput() || isCustomActive()}>
              <input
                type="text"
                class="w-24 rounded border px-2 py-1 font-mono text-sm"
                classList={{ "border-danger": !validation().valid, "border-base-300": validation().valid }}
                placeholder="#000000"
                value={customHex()}
                onInput={(e) => setCustomHex(e.currentTarget.value)}
                onBlur={applyCustom}
                onKeyDown={(e) => { if (e.key === "Enter") applyCustom(); }}
              />
              <Show when={!validation().valid}>
                <span class="text-danger text-xs">{(validation() as { reason: string }).reason}</span>
              </Show>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
