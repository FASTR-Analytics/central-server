import type {
  ContentSlide,
  ContentBlock,
  ContentSlideSplit,
  FigureBlock,
  TextBlock,
  ImageBlock,
  LogoVisibility,
} from "platform-lib";
import type { PatternType } from "panther";
import {
  TextArea,
  findById,
  type LayoutNode,
  Select,
  Button,
  RadioGroup,
  Checkbox,
} from "panther";
import { Match, type Setter, Show, Switch } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { convertBlockType } from "../slide_transforms/convert_block_type";

type Props = {
  projectId: string;
  tempSlide: ContentSlide;
  setTempSlide: SetStoreFunction<any>;
  selectedBlockId: string | undefined;
  setSelectedBlockId: Setter<string | undefined>;
  contentTab: "slide" | "block";
  setContentTab: Setter<"slide" | "block">;
  onShowLayoutMenu: (x: number, y: number) => void;
  onSelectVisualization: () => void;
  showHeaderLogosByDefault: boolean;
  showFooterLogosByDefault: boolean;
  hasGlobalFooterText: boolean;
};

function getLogoVisibilityOptions(showByDefault: boolean) {
  return [
    { value: "inherit", label: showByDefault ? "Default (show)" : "Default (hide)" },
    { value: "show", label: "Show" },
    { value: "hide", label: "Hide" },
  ];
}

export function SlideEditorPanelContent(p: Props) {
  const blockTypeCache = new Map<string, ContentBlock>();

  function cacheKey(blockId: string, blockType: string) {
    return `${blockId}_${blockType}`;
  }

  function getCurrentBlock(): ContentBlock | undefined {
    if (!p.selectedBlockId) return undefined;
    const result = findById(p.tempSlide.layout, p.selectedBlockId);
    if (!result || result.node.type !== "item") return undefined;
    return result.node.data;
  }

  function updateSelectedBlock(updater: (block: ContentBlock) => ContentBlock) {
    if (!p.selectedBlockId) return;

    function updateNode(node: LayoutNode<ContentBlock>): LayoutNode<ContentBlock> {
      if (node.id === p.selectedBlockId && node.type === "item") {
        return { ...node, data: updater(node.data) };
      }
      if (node.type === "rows" || node.type === "cols") {
        return { ...node, children: node.children.map(updateNode) };
      }
      return node;
    }

    const newLayout = updateNode(p.tempSlide.layout);
    p.setTempSlide("layout", newLayout);
  }

  function handleBlockTypeChange(newType: string) {
    if (!p.selectedBlockId) return;
    const current = getCurrentBlock();
    if (!current || current.type === newType) return;

    blockTypeCache.set(cacheKey(p.selectedBlockId, current.type), current);

    const cached = blockTypeCache.get(cacheKey(p.selectedBlockId, newType));
    if (cached) {
      updateSelectedBlock(() => cached);
    } else {
      const newLayout = convertBlockType(
        p.tempSlide.layout,
        p.selectedBlockId,
        newType as "text" | "figure" | "image",
      );
      p.setTempSlide("layout", newLayout);
    }
  }

  return (
    <div class="flex h-full w-full flex-col">
      <div class="flex w-full flex-none border-b">
        <div
          class="ui-hoverable data-[selected=true]:bg-base-200 flex-1 border-r py-2 text-center"
          onClick={() => p.setContentTab("slide")}
          data-selected={p.contentTab === "slide"}
        >
          Header / Footer
        </div>
        <div
          class="ui-hoverable data-[selected=true]:bg-base-200 flex-1 py-2 text-center"
          onClick={() => p.setContentTab("block")}
          data-selected={p.contentTab === "block"}
        >
          Content
        </div>
      </div>

      <div class="h-0 w-full flex-1">
        <Switch>
          <Match when={p.contentTab === "slide"}>
            <div class="h-full overflow-auto">
              <div class="ui-pad ui-spy-sm">
                <TextArea
                  label="Header"
                  value={p.tempSlide.header ?? ""}
                  onChange={(v: string) => p.setTempSlide("header", v || undefined)}
                  fullWidth
                  height="60px"
                />
                <TextArea
                  label="Sub Header"
                  value={p.tempSlide.subHeader ?? ""}
                  onChange={(v: string) => p.setTempSlide("subHeader", v || undefined)}
                  fullWidth
                  height="40px"
                />
                <TextArea
                  label="Date"
                  value={p.tempSlide.date ?? ""}
                  onChange={(v: string) => p.setTempSlide("date", v || undefined)}
                  fullWidth
                  height="40px"
                />
                <Select
                  label="Header logos"
                  value={p.tempSlide.showHeaderLogos ?? "inherit"}
                  options={getLogoVisibilityOptions(p.showHeaderLogosByDefault)}
                  onChange={(v) =>
                    p.setTempSlide(
                      "showHeaderLogos",
                      v === "inherit" ? undefined : (v as LogoVisibility),
                    )
                  }
                />
              </div>
              <hr class="border-base-300 mt-3 mb-1" />
              <div class="ui-pad ui-spy-sm">
                <Show
                  when={!p.hasGlobalFooterText}
                  fallback={
                    <div class="text-neutral text-xs">
                      Footer text is set at the deck level
                    </div>
                  }
                >
                  <TextArea
                    label="Footer text"
                    value={p.tempSlide.footer ?? ""}
                    onChange={(v: string) => p.setTempSlide("footer", v || undefined)}
                    fullWidth
                    height="40px"
                  />
                </Show>
                <Select
                  label="Footer logos"
                  value={p.tempSlide.showFooterLogos ?? "inherit"}
                  options={getLogoVisibilityOptions(p.showFooterLogosByDefault)}
                  onChange={(v) =>
                    p.setTempSlide(
                      "showFooterLogos",
                      v === "inherit" ? undefined : (v as LogoVisibility),
                    )
                  }
                />
              </div>
              <hr class="border-base-300 mt-3 mb-1" />
              <div class="ui-pad ui-spy-sm">
                <Checkbox
                  label="Add split panel"
                  checked={!!p.tempSlide.split}
                  onChange={(checked) => {
                    if (checked) {
                      p.setTempSlide("split", {
                        placement: "left",
                        sizeAsPct: 15,
                        fill: { type: "plain" },
                      } satisfies ContentSlideSplit);
                    } else {
                      p.setTempSlide("split", undefined);
                    }
                  }}
                />
                <Show when={p.tempSlide.split}>
                  <Select
                    label="Placement"
                    value={p.tempSlide.split!.placement}
                    options={[
                      { value: "left", label: "Left" },
                      { value: "right", label: "Right" },
                    ]}
                    onChange={(v) =>
                      p.setTempSlide("split", "placement", v as "left" | "right")
                    }
                    fullWidth
                  />
                  <Select
                    label="Size"
                    value={String(p.tempSlide.split!.sizeAsPct)}
                    options={[
                      { value: "5", label: "5%" },
                      { value: "10", label: "10%" },
                      { value: "15", label: "15%" },
                      { value: "20", label: "20%" },
                      { value: "25", label: "25%" },
                      { value: "30", label: "30%" },
                      { value: "35", label: "35%" },
                      { value: "40", label: "40%" },
                      { value: "45", label: "45%" },
                      { value: "50", label: "50%" },
                    ]}
                    onChange={(v) => p.setTempSlide("split", "sizeAsPct", Number(v))}
                    fullWidth
                  />
                  <Select
                    label="Fill"
                    value={p.tempSlide.split!.fill.type}
                    options={[
                      { value: "plain", label: "Plain" },
                      { value: "pattern", label: "Pattern" },
                      { value: "image", label: "Image" },
                    ]}
                    onChange={(v) => {
                      if (v === "plain") {
                        p.setTempSlide("split", "fill", { type: "plain" });
                      } else if (v === "pattern") {
                        p.setTempSlide("split", "fill", { type: "pattern", patternType: "ovals" });
                      } else if (v === "image") {
                        p.setTempSlide("split", "fill", { type: "image", imgFile: "" });
                      }
                    }}
                    fullWidth
                  />
                  <Show when={p.tempSlide.split!.fill.type === "pattern"}>
                    <Select
                      label="Pattern"
                      value={
                        (p.tempSlide.split!.fill as { type: "pattern"; patternType: PatternType })
                          .patternType
                      }
                      options={[
                        { value: "ovals", label: "Ovals" },
                        { value: "circles", label: "Circles" },
                        { value: "dots", label: "Dots" },
                        { value: "lines", label: "Lines" },
                        { value: "grid", label: "Grid" },
                        { value: "chevrons", label: "Chevrons" },
                        { value: "waves", label: "Waves" },
                        { value: "noise", label: "Noise" },
                      ]}
                      onChange={(v) =>
                        p.setTempSlide("split", "fill", {
                          type: "pattern",
                          patternType: v as PatternType,
                        })
                      }
                      fullWidth
                    />
                  </Show>
                  <Show when={p.tempSlide.split!.fill.type === "image"}>
                    <div>
                      <div class="ui-label">Image URL</div>
                      <input
                        type="text"
                        class="border-base-300 w-full rounded border px-2 py-1.5 text-sm"
                        placeholder="https://..."
                        value={
                          (p.tempSlide.split!.fill as { type: "image"; imgFile: string }).imgFile
                        }
                        onInput={(e) =>
                          p.setTempSlide("split", "fill", {
                            type: "image",
                            imgFile: e.currentTarget.value,
                          })
                        }
                      />
                    </div>
                  </Show>
                </Show>
              </div>
            </div>
          </Match>

          <Match when={p.contentTab === "block"}>
            <div class="h-full overflow-auto">
              <Show
                when={getCurrentBlock()}
                fallback={
                  <div class="ui-pad text-base-content/70 text-sm">
                    Click a block on the canvas to edit it
                  </div>
                }
              >
                <div class="ui-pad ui-spy">
                  <div class="ui-gap-sm flex items-end">
                    <Select
                      label="Content type"
                      options={[
                        { value: "text", label: "Text" },
                        { value: "figure", label: "Visualization" },
                        { value: "image", label: "Image" },
                      ]}
                      value={getCurrentBlock()?.type}
                      onChange={handleBlockTypeChange}
                      fullWidth
                    />
                    <Button
                      outline
                      onClick={(e: MouseEvent) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        p.onShowLayoutMenu(rect.left, rect.bottom);
                      }}
                    >
                      Layout
                    </Button>
                  </div>
                  <Switch>
                    <Match when={getCurrentBlock()?.type === "text"}>
                      <TextArea
                        label="Text"
                        value={(getCurrentBlock() as TextBlock).markdown}
                        onChange={(v: string) =>
                          updateSelectedBlock((b: any) => ({ ...b, markdown: v }))
                        }
                        fullWidth
                        height="300px"
                      />
                      <Select
                        label="Text background"
                        options={[
                          { value: "none", label: "None" },
                          { value: "primary", label: "Theme color" },
                          { value: "grey", label: "Light grey" },
                          { value: "success", label: "Green" },
                          { value: "danger", label: "Red" },
                        ]}
                        value={(getCurrentBlock() as TextBlock).style?.textBackground ?? "none"}
                        onChange={(v: string) =>
                          updateSelectedBlock((b) => {
                            const tb = b as TextBlock;
                            return { ...tb, style: { ...tb.style, textBackground: v } };
                          })
                        }
                        fullWidth
                      />
                    </Match>
                    <Match when={getCurrentBlock()?.type === "figure"}>
                      {(() => {
                        const block = () => getCurrentBlock() as FigureBlock;
                        const hasFigure = () =>
                          !!block().bundle ||
                          !!(block() as { figureInputs?: unknown }).figureInputs;
                        return (
                          <div class="ui-gap-sm flex flex-col">
                            <Button onClick={() => p.onSelectVisualization()}>
                              {hasFigure() ? "Switch Visualization" : "Select Visualization"}
                            </Button>
                            <Show when={hasFigure()}>
                              <Button
                                intent="danger"
                                outline
                                onClick={() =>
                                  updateSelectedBlock(() => ({ type: "figure" as const }))
                                }
                              >
                                Remove Visualization
                              </Button>
                            </Show>
                          </div>
                        );
                      })()}
                    </Match>
                    <Match when={getCurrentBlock()?.type === "image"}>
                      <ImageBlockEditor
                        block={() => getCurrentBlock() as ImageBlock}
                        updateSelectedBlock={updateSelectedBlock}
                      />
                    </Match>
                  </Switch>
                </div>
              </Show>
            </div>
          </Match>
        </Switch>
      </div>
    </div>
  );
}

function ImageBlockEditor(p: {
  block: () => ImageBlock;
  updateSelectedBlock: (updater: (block: ContentBlock) => ContentBlock) => void;
}) {
  return (
    <div class="ui-spy">
      <div>
        <div class="ui-label">Image URL</div>
        <input
          type="text"
          class="border-base-300 w-full rounded border px-2 py-1.5 text-sm"
          placeholder="https://..."
          value={p.block().imgFile}
          onInput={(e) =>
            p.updateSelectedBlock((b) => ({ ...b, imgFile: e.currentTarget.value }))
          }
        />
      </div>
      <Show when={p.block().imgFile}>
        <RadioGroup
          label="Image fit"
          value={p.block().style?.imgFit ?? "contain"}
          options={[
            { value: "cover", label: "Cover whole area" },
            { value: "contain", label: "Fit inside area" },
          ]}
          onChange={(v: string) =>
            p.updateSelectedBlock((b) => {
              const ib = b as ImageBlock;
              return { ...ib, style: { ...ib.style, imgFit: v as "cover" | "contain" } };
            })
          }
        />
        <Show when={(p.block().style?.imgFit ?? "contain") === "contain"}>
          <Select
            label="Alignment"
            options={[
              { value: "center", label: "Center" },
              { value: "top", label: "Top" },
              { value: "bottom", label: "Bottom" },
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
            value={p.block().style?.imgAlign ?? "center"}
            onChange={(v: string) =>
              p.updateSelectedBlock((b) => {
                const ib = b as ImageBlock;
                return {
                  ...ib,
                  style: {
                    ...ib.style,
                    imgAlign: v as "center" | "top" | "bottom" | "left" | "right",
                  },
                };
              })
            }
            fullWidth
          />
        </Show>
      </Show>
    </div>
  );
}
