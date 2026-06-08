import { For } from "solid-js";
import { getLayoutPresets, type LayoutPresetId } from "panther";
import { PresetCard } from "./PresetCard.tsx";

type LayoutPickerProps = {
  value: LayoutPresetId;
  onChange: (id: LayoutPresetId) => void;
};

const THUMBNAIL_COLOR = "#64748b";

function LayoutThumbnail(p: { layoutId: LayoutPresetId }) {
  const alignItems = () => {
    if (p.layoutId === "modern") return "items-end";
    if (p.layoutId === "corporate" || p.layoutId === "split") return "items-start";
    return "items-center";
  };

  const justifyContent = () => {
    if (p.layoutId === "modern") return "justify-start";
    if (p.layoutId === "corporate" || p.layoutId === "split") return "justify-start";
    return "justify-center";
  };

  const innerAlign = () => {
    if (p.layoutId === "modern") return "items-start";
    if (p.layoutId === "corporate" || p.layoutId === "split") return "items-start";
    return "items-center";
  };

  const hasSplit = () => p.layoutId === "split";

  return (
    <div class="flex h-full w-full" style={{ background: THUMBNAIL_COLOR }}>
      {hasSplit() && (
        <div class="h-full" style={{ width: "30%", background: "rgba(255,255,255,0.15)" }} />
      )}
      <div class={`flex flex-1 p-2 ${alignItems()} ${justifyContent()}`}>
        <div class={`flex flex-col ${innerAlign()}`}>
          <div class="h-1.5 rounded bg-white/90" style={{ width: "32px" }} />
          <div class="mt-1 h-1 rounded bg-white/60" style={{ width: "20px" }} />
        </div>
      </div>
    </div>
  );
}

export function LayoutPicker(p: LayoutPickerProps) {
  const presets = getLayoutPresets();

  return (
    <div>
      <div class="ui-label">Layout</div>
      <div class="ui-gap-sm flex">
        <For each={presets}>
          {(preset) => (
            <PresetCard
              name={preset.name}
              selected={p.value === preset.id}
              onClick={() => p.onChange(preset.id)}
            >
              <LayoutThumbnail layoutId={preset.id} />
            </PresetCard>
          )}
        </For>
      </div>
    </div>
  );
}
