import { trackStore } from "@solid-primitives/deep";
import type {
  ContentBlock,
  ContentSlide,
  CoverSlide,
  FigureBlock,
  SectionSlide,
  Slide,
  SlideDeckConfig,
} from "platform-lib";
import { PAGE_HEIGHT_DU, PAGE_WIDTH_DU } from "platform-lib";
import type { DividerDragUpdate, LayoutItemSwapUpdate, LayoutNode } from "panther";
import {
  AlertComponentProps,
  APIResponseWithData,
  Button,
  FrameLeftResizable,
  FrameTop,
  getQueryStateFromApiResponse,
  HeadingBar,
  PageHolder,
  PageInputs,
  Select,
  StateHolder,
  applyDividerDragUpdate,
  findNodeInDraft,
  createItemNode,
  findById,
  getEditorWrapper,
  openAlert,
  showMenu,
  timActionButton,
} from "panther";
import { Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { createStore, produce, reconcile, unwrap, type SetStoreFunction } from "solid-js/store";
import { buildLayoutContextMenu } from "~/components/layout_editor/build_context_menu";
import { serverActions } from "~/server_actions";
import { createIdGeneratorForLayout } from "~/components/slide_deck/_id_generation";
import { SelectVisualizationForSlide } from "../select_visualization_for_slide";
import { convertSlideToPageInputs } from "~/generate_slide_deck/convert_slide_to_page_inputs";
import { convertBlockType } from "../slide_transforms/convert_block_type";
import { convertSlideType } from "../slide_transforms/convert_slide_type";
import { SlideEditorPanel } from "./editor_panel";

function updateBlockInLayout(
  layout: LayoutNode<ContentBlock>,
  targetId: string,
  updater: (block: ContentBlock) => ContentBlock,
): LayoutNode<ContentBlock> {
  if (layout.type === "item") {
    if (layout.id === targetId) {
      return { ...layout, data: updater(layout.data) };
    }
    return layout;
  }

  return {
    ...layout,
    children: layout.children.map((child) =>
      updateBlockInLayout(child as LayoutNode<ContentBlock>, targetId, updater),
    ),
  };
}

type SlideEditorInnerProps = {
  projectId: string;
  deckId: string;
  deckLabel: string;
  slideId: string;
  slide: Slide;
  lastUpdated: string;
  deckConfigSnapshot: SlideDeckConfig;
};

type Props = AlertComponentProps<SlideEditorInnerProps, boolean>;

export function SlideEditor(p: Props) {
  const { openEditor, EditorWrapper } = getEditorWrapper();

  const normalizedSlide = p.slide;

  const [needsSave, setNeedsSave] = createSignal(false);
  const [lastKnownServerTimestamp, setLastKnownServerTimestamp] = createSignal(p.lastUpdated);
  const [tempSlide, setTempSlide] = createStore<Slide>(structuredClone(normalizedSlide));

  const typeCache: {
    cover?: CoverSlide;
    section?: SectionSlide;
    content?: ContentSlide;
  } = {};

  const [pageInputs, setPageInputs] = createSignal<StateHolder<PageInputs>>({
    status: "loading",
    msg: "Rendering...",
  });
  const [selectedBlockId, setSelectedBlockId] = createSignal<string | undefined>();
  const [contentTab, setContentTab] = createSignal<"slide" | "block">("slide");

  async function attemptGetPageInputs(slide: Slide) {
    const res = await convertSlideToPageInputs(p.projectId, slide, undefined, p.deckConfigSnapshot);
    setPageInputs(getQueryStateFromApiResponse(res));
  }

  let renderTimeout: ReturnType<typeof setTimeout> | null = null;
  let firstRun = true;

  createEffect(() => {
    trackStore(tempSlide);
    if (firstRun) {
      firstRun = false;
      return;
    }

    setNeedsSave(true);

    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }

    renderTimeout = setTimeout(() => {
      attemptGetPageInputs(unwrap(tempSlide));
    }, 100);
  });

  onMount(() => {
    attemptGetPageInputs(unwrap(tempSlide));
  });

  onCleanup(() => {
    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }
  });

  async function saveFunc(): Promise<APIResponseWithData<{ lastUpdated: string }>> {
    if (!needsSave()) {
      return { success: true, data: { lastUpdated: lastKnownServerTimestamp() } };
    }

    const updateRes = await serverActions.updateSlide({
      projectId: p.projectId,
      slideId: p.slideId,
      slide: unwrap(tempSlide),
    });

    if (!updateRes.success) return updateRes;

    setNeedsSave(false);
    setLastKnownServerTimestamp(updateRes.data.lastUpdated);
    return updateRes;
  }

  const saveAndClose = timActionButton(
    () => saveFunc(),
    (_data) => {
      p.close(true);
    },
  );

  const save = timActionButton(
    () => saveFunc(),
    (_data) => {},
  );

  function handleCancel() {
    p.close(false);
  }

  function handleDividerDrag(update: DividerDragUpdate) {
    if (tempSlide.type !== "content") return;
    const currentSlide = unwrap(tempSlide) as ContentSlide;
    const updatedLayout = applyDividerDragUpdate(currentSlide.layout, update);
    setTempSlide(reconcile({ ...currentSlide, layout: updatedLayout }));
  }

  function handleLayoutItemSwap(update: LayoutItemSwapUpdate) {
    setTempSlide(
      produce((draft) => {
        if (draft.type !== "content") return;
        const nodeA = findNodeInDraft(draft.layout, update.sourceNodeId);
        const nodeB = findNodeInDraft(draft.layout, update.targetNodeId);
        if (!nodeA || !nodeB) return;
        if (nodeA.type !== "item" || nodeB.type !== "item") return;
        const tmpData = nodeA.data;
        const tmpStyle = nodeA.style;
        nodeA.data = nodeB.data;
        nodeA.style = nodeB.style;
        nodeB.data = tmpData;
        nodeB.style = tmpStyle;
      }),
    );
  }

  function handleTypeChange(newType: "cover" | "section" | "content") {
    const currentSlide = unwrap(tempSlide);

    if (currentSlide.type === "cover") typeCache.cover = structuredClone(currentSlide);
    else if (currentSlide.type === "section") typeCache.section = structuredClone(currentSlide);
    else if (currentSlide.type === "content") typeCache.content = structuredClone(currentSlide);

    let converted: Slide;
    if (newType === "cover" && typeCache.cover) {
      converted = typeCache.cover;
    } else if (newType === "section" && typeCache.section) {
      converted = typeCache.section;
    } else if (newType === "content" && typeCache.content) {
      converted = typeCache.content;
    } else {
      converted = convertSlideType(currentSlide, newType);
    }

    setTempSlide(reconcile(converted));
    setNeedsSave(true);
  }

  function getLayoutCallbacks() {
    if (tempSlide.type !== "content") return undefined;
    const contentSlide = unwrap(tempSlide) as ContentSlide;
    const idGenerator = createIdGeneratorForLayout(contentSlide.layout);
    return {
      onLayoutChange: (newLayout: LayoutNode<ContentBlock>) => {
        setTempSlide(reconcile({ ...unwrap(tempSlide), layout: newLayout }));
      },
      onSelectionChange: setSelectedBlockId,
      createNewBlock: () =>
        createItemNode<ContentBlock>({ type: "text", markdown: "" }, undefined, idGenerator),
      idGenerator,
      getBlockType: (block: ContentBlock) => block.type,
      isFigureWithSource: (_block: ContentBlock) => false,
      isEmptyFigure: (block: ContentBlock) => block.type === "figure" && !block.figureInputs,
      onEditVisualization: async (_blockId: string) => {},
      onSelectVisualization: async (blockId: string) => {
        await handleSelectVisualization(blockId);
      },
      onReplaceVisualization: async (blockId: string) => {
        await handleSelectVisualization(blockId);
      },
      onCreateVisualization: async (_blockId: string) => {},
      onRemoveVisualization: (blockId: string) => {
        if (tempSlide.type !== "content") return;
        const updatedLayout = updateBlockInLayout(
          tempSlide.layout,
          blockId,
          () => ({ type: "figure" as const }),
        );
        setTempSlide(reconcile({ ...unwrap(tempSlide), layout: updatedLayout }));
      },
    };
  }

  function handleShowLayoutMenu(x: number, y: number) {
    const blockId = selectedBlockId();
    if (!blockId || tempSlide.type !== "content") return;
    const callbacks = getLayoutCallbacks();
    if (!callbacks) return;
    const items = buildLayoutContextMenu(tempSlide.layout, blockId, callbacks);
    showMenu({ anchor: { x, y, width: 0, height: 0 }, items });
  }

  async function handleSelectVisualization(blockIdOverride?: string) {
    const blockId = blockIdOverride ?? selectedBlockId();
    if (!blockId || tempSlide.type !== "content") return;

    const result = await openEditor({
      element: SelectVisualizationForSlide,
      props: { projectId: p.projectId },
    });

    if (!result) return;

    const updatedLayout = updateBlockInLayout(
      tempSlide.layout,
      blockId,
      () => result as FigureBlock,
    );

    setTempSlide(reconcile({ ...unwrap(tempSlide), layout: updatedLayout }));
  }

  return (
    <EditorWrapper>
      <FrameTop
        panelChildren={
          <HeadingBar
            heading="Edit Slide"
            leftChildren={
              <Show
                when={needsSave()}
                fallback={<Button iconName="chevronLeft" onClick={handleCancel} />}
              >
                <div class="ui-gap-sm flex items-center">
                  <Button
                    intent="success"
                    onClick={saveAndClose.click}
                    state={saveAndClose.state()}
                    iconName="save"
                  >
                    Save and close
                  </Button>
                  <Button
                    intent="success"
                    onClick={save.click}
                    state={save.state()}
                    iconName="save"
                  >
                    Save
                  </Button>
                  <Button outline onClick={handleCancel} iconName="x">
                    Cancel
                  </Button>
                </div>
              </Show>
            }
          >
            <Select
              options={[
                { value: "cover", label: "Cover" },
                { value: "section", label: "Section" },
                { value: "content", label: "Content" },
              ]}
              value={tempSlide.type}
              onChange={(v: string) =>
                handleTypeChange(v as "cover" | "section" | "content")
              }
            />
          </HeadingBar>
        }
      >
        <FrameLeftResizable
          startingWidth={400}
          minWidth={300}
          maxWidth={600}
          hoverOffset="offset-for-border-1-on-left"
          panelChildren={
            <SlideEditorPanel
              projectId={p.projectId}
              tempSlide={tempSlide}
              setTempSlide={setTempSlide}
              selectedBlockId={selectedBlockId()}
              setSelectedBlockId={setSelectedBlockId}
              contentTab={contentTab()}
              setContentTab={setContentTab}
              onShowLayoutMenu={handleShowLayoutMenu}
              onSelectVisualization={() => handleSelectVisualization()}
              showCoverLogosByDefault={p.deckConfigSnapshot.logos.cover.showByDefault}
              showHeaderLogosByDefault={p.deckConfigSnapshot.logos.header.showByDefault}
              showFooterLogosByDefault={p.deckConfigSnapshot.logos.footer.showByDefault}
              hasGlobalFooterText={p.deckConfigSnapshot.globalFooterText !== undefined}
            />
          }
        >
          <div class="ui-pad bg-base-200 h-full w-full overflow-auto">
            <Show when={pageInputs().status === "loading"}>
              <div class="flex h-full items-center justify-center">
                <div class="text-base-content/70">Rendering slide...</div>
              </div>
            </Show>
            <Show when={pageInputs().status === "error"}>
              <div class="flex h-full items-center justify-center">
                <div class="text-error">Error: {(pageInputs() as any).err}</div>
              </div>
            </Show>
            <Show
              when={
                pageInputs().status === "ready"
                  ? (pageInputs() as { status: "ready"; data: PageInputs }).data
                  : undefined
              }
              keyed
            >
              {(keyedPageInputs) => (
                <div class="ui-pad bg-base-200 h-full w-full overflow-auto">
                  <PageHolder
                    pageInputs={keyedPageInputs}
                    canvasElementId="SLIDE_EDITOR_CANVAS"
                    pageWidthDu={PAGE_WIDTH_DU}
                    pageHeightDu={PAGE_HEIGHT_DU}
                    fitWithin={true}
                    hoverStyle={{
                      fillColor: "rgba(0, 112, 243, 0.1)",
                      strokeColor: "rgba(0, 112, 243, 0.8)",
                      strokeWidth: 2,
                      showLayoutBoundaries: true,
                    }}
                    onClick={(target) => {
                      if (target.type === "layoutItem") {
                        setSelectedBlockId(target.node.id);
                        setContentTab("block");
                      } else if (
                        target.type === "headerText" ||
                        target.type === "subHeaderText" ||
                        target.type === "dateText" ||
                        target.type === "footerText" ||
                        target.type === "coverTitle" ||
                        target.type === "coverSubTitle" ||
                        target.type === "coverAuthor" ||
                        target.type === "coverDate" ||
                        target.type === "sectionTitle" ||
                        target.type === "sectionSubTitle"
                      ) {
                        setSelectedBlockId(undefined);
                        setContentTab("slide");
                      }
                    }}
                    onDividerDrag={handleDividerDrag}
                    onLayoutItemSwap={handleLayoutItemSwap}
                    onContextMenu={(e, target) => {
                      if (target.type !== "layoutItem") return;
                      const callbacks = getLayoutCallbacks();
                      if (!callbacks) return;
                      const items = buildLayoutContextMenu(
                        (tempSlide as ContentSlide).layout,
                        target.node.id,
                        {
                          ...callbacks,
                          onEditVisualization: async (_blockId: string) => {},
                          onSelectVisualization: async (blockId: string) => {
                            await handleSelectVisualization(blockId);
                          },
                          onReplaceVisualization: async (blockId: string) => {
                            await handleSelectVisualization(blockId);
                          },
                          onConvertToText: (blockId: string) => {
                            const newLayout = convertBlockType(
                              (tempSlide as ContentSlide).layout,
                              blockId,
                              "text",
                            );
                            setTempSlide(reconcile({ ...unwrap(tempSlide), layout: newLayout }));
                            setSelectedBlockId(blockId);
                            setContentTab("block");
                          },
                          onConvertToFigure: (blockId: string) => {
                            const newLayout = convertBlockType(
                              (tempSlide as ContentSlide).layout,
                              blockId,
                              "figure",
                            );
                            setTempSlide(reconcile({ ...unwrap(tempSlide), layout: newLayout }));
                            setSelectedBlockId(blockId);
                            setContentTab("block");
                          },
                          onConvertToImage: (blockId: string) => {
                            const newLayout = convertBlockType(
                              (tempSlide as ContentSlide).layout,
                              blockId,
                              "image",
                            );
                            setTempSlide(reconcile({ ...unwrap(tempSlide), layout: newLayout }));
                            setSelectedBlockId(blockId);
                            setContentTab("block");
                          },
                        },
                      );
                      showMenu({
                        anchor: { x: e.clientX, y: e.clientY, width: 0, height: 0 },
                        items,
                      });
                    }}
                  />
                </div>
              )}
            </Show>
          </div>
        </FrameLeftResizable>
      </FrameTop>
    </EditorWrapper>
  );
}
