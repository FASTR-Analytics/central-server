import { Slider } from "panther";
import { createUniqueId, type JSX, Show } from "solid-js";

type TextStyleDefaults = {
  size: number;
  bold: boolean;
  italic: boolean;
};

type TextStylePopoverProps = {
  size: number;
  onSizeChange: (size: number) => void;
  bold: boolean;
  onBoldChange: (bold: boolean) => void;
  italic: boolean;
  onItalicChange: (italic: boolean) => void;
  sizeMin?: number;
  sizeMax?: number;
  defaults?: TextStyleDefaults;
  onReset?: () => void;
  label?: string;
};

const POSITION_STYLE = {
  top: "anchor(bottom)",
  left: "anchor(left)",
};

export function TextStylePopover(p: TextStylePopoverProps) {
  const id = createUniqueId();
  const popoverId = `text-style-popover-${id}`;
  const anchorName = `--text-style-anchor-${id}`;

  const sizeMin = () => p.sizeMin ?? 2;
  const sizeMax = () => p.sizeMax ?? 20;

  return (
    <div class="select-none">
      <Show when={p.label}>
        <div class="ui-label">{p.label}</div>
      </Show>
      <button
        type="button"
        class="ui-hoverable border-base-300 flex items-center gap-2 rounded border px-3 py-1.5"
        style={{ "anchor-name": anchorName } as JSX.CSSProperties}
        // @ts-ignore - popovertarget is valid HTML
        popovertarget={popoverId}
      >
        <span class="text-sm tabular-nums">{p.size}</span>
        <span
          class="w-5 rounded py-0.5 text-xs"
          classList={{
            "bg-primary text-primary-content": p.bold,
            "bg-base-200 text-base-content": !p.bold,
          }}
        >
          B
        </span>
        <span
          class="w-5 rounded py-0.5 text-xs italic"
          classList={{
            "bg-primary text-primary-content": p.italic,
            "bg-base-200 text-base-content": !p.italic,
          }}
        >
          I
        </span>
      </button>
      <div
        id={popoverId}
        // @ts-ignore - popover is valid HTML
        popover
        style={
          {
            position: "absolute",
            "position-anchor": anchorName,
            margin: "6px",
            background: "transparent",
            border: "none",
            padding: "0",
            ...POSITION_STYLE,
          } as JSX.CSSProperties
        }
      >
        <div class="bg-base-100 w-64 rounded-md border p-3 shadow-lg select-none">
          <Slider
            label="Size"
            min={sizeMin()}
            max={sizeMax()}
            step={1}
            value={p.size}
            onChange={p.onSizeChange}
            fullWidth
            showValueInLabel
          />
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              class="flex-1 cursor-pointer rounded border py-1.5 text-sm font-bold"
              classList={{
                "bg-primary text-primary-content border-primary": p.bold,
                "bg-base-100 text-base-content border-base-300 hover:bg-base-200": !p.bold,
              }}
              onClick={() => p.onBoldChange(!p.bold)}
            >
              Bold
            </button>
            <button
              type="button"
              class="flex-1 cursor-pointer rounded border py-1.5 text-sm italic"
              classList={{
                "bg-primary text-primary-content border-primary": p.italic,
                "bg-base-100 text-base-content border-base-300 hover:bg-base-200": !p.italic,
              }}
              onClick={() => p.onItalicChange(!p.italic)}
            >
              Italic
            </button>
          </div>
          <Show when={p.defaults && p.onReset}>
            <button
              type="button"
              class="bg-base-100 text-base-content border-base-300 hover:bg-base-200 mt-3 w-full cursor-pointer rounded border py-1.5 text-sm"
              onClick={() => p.onReset?.()}
            >
              Reset to default
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
