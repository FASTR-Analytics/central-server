import type { JSX } from "solid-js";

type PresetCardProps = {
  name: string;
  selected: boolean;
  onClick: () => void;
  children: JSX.Element;
};

export function PresetCard(p: PresetCardProps) {
  return (
    <button
      type="button"
      class="flex w-24 cursor-pointer flex-col rounded-lg border p-2 text-left"
      classList={{
        "border-primary border-2": p.selected,
        "border-base-300 hover:border-base-400": !p.selected,
      }}
      onClick={p.onClick}
    >
      <div class="border-base-300 relative mb-1 aspect-video overflow-hidden rounded border">
        {p.children}
      </div>
      <div class="text-center text-sm font-medium">{p.name}</div>
    </button>
  );
}
