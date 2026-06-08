import { type SlideFontFamily, SLIDE_FONTS } from "platform-lib";
import { For } from "solid-js";

type Props = {
  value: SlideFontFamily | undefined;
  onChange: (v: SlideFontFamily) => void;
};

export function FontPicker(p: Props) {
  const selected = () => p.value ?? "International Inter";

  return (
    <div>
      <div class="ui-label">Font</div>
      <div class="flex gap-2">
        <For each={SLIDE_FONTS}>
          {(font) => (
            <button
              type="button"
              class={`cursor-pointer rounded border px-4 py-2 ${
                selected() === font.family
                  ? "border-primary bg-primary/10 border-2"
                  : "border-base-300 hover:border-primary/50"
              }`}
              style={{ "font-family": font.family }}
              onClick={() => p.onChange(font.family)}
            >
              {font.label}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
