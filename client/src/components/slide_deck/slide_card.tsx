import type { SlideDeckConfig } from "platform-lib";
import { PAGE_HEIGHT_DU, PAGE_WIDTH_DU } from "platform-lib";
import {
  getQueryStateFromApiResponse,
  PageHolder,
  type StateHolder,
  type PageInputs,
  showMenu,
  type MenuItem,
} from "panther";
import { createEffect, createSignal, Show } from "solid-js";
import { serverActions } from "~/server_actions";
import { convertSlideToPageInputs } from "~/generate_slide_deck/convert_slide_to_page_inputs";

type Props = {
  projectId: string;
  deckId: string;
  slideId: string;
  index: number;
  isSelected: boolean;
  selectedCount: number;
  slideSize: number;
  fillWidth: boolean;
  onCardClick: (event: MouseEvent, isCircleClick: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  deckConfig: SlideDeckConfig;
  refreshKey: number;
};

export function SlideCard(p: Props) {
  const [pageInputs, setPageInputs] = createSignal<StateHolder<PageInputs>>({
    status: "loading",
    msg: "Loading...",
  });

  createEffect(async () => {
    const _rk = p.refreshKey;
    const slideId = p.slideId;
    const config = p.deckConfig;
    const index = p.index;

    setPageInputs({ status: "loading", msg: "Loading..." });

    const res = await serverActions.getSlide({ projectId: p.projectId, slideId });
    if (!res.success) {
      setPageInputs({ status: "error", err: res.err });
      return;
    }

    const renderRes = await convertSlideToPageInputs(p.projectId, res.data.slide, index, config);
    setPageInputs(getQueryStateFromApiResponse(renderRes));
  });

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();

    const deleteLabel =
      p.isSelected && p.selectedCount > 1
        ? `Delete ${p.selectedCount} slides`
        : "Delete slide";

    const duplicateLabel =
      p.isSelected && p.selectedCount > 1
        ? `Duplicate ${p.selectedCount} slides`
        : "Duplicate slide";

    const items: MenuItem[] = [
      { label: "Edit slide", icon: "pencil", onClick: p.onEdit },
      { label: duplicateLabel, icon: "copy", onClick: p.onDuplicate },
      { label: deleteLabel, icon: "trash", intent: "danger", onClick: p.onDelete },
    ];
    showMenu({ anchor: { x: e.clientX, y: e.clientY, width: 0, height: 0 }, items });
  }

  return (
    <div
      classList={{ "sortable-selected": p.isSelected }}
      style={{ width: p.fillWidth ? "100%" : `${p.slideSize}px` }}
    >
      <div class="mb-2 text-base-content text-center text-sm font-medium">{p.index + 1}</div>
      <div
        class="slide-card-wrapper group relative overflow-clip rounded-lg border bg-white cursor-pointer"
        classList={{
          "border-base-300": !p.isSelected,
          "border-primary": p.isSelected,
          "hover:border-primary": !p.isSelected,
        }}
        onContextMenu={handleContextMenu}
        onClick={(e) => {
          e.stopPropagation();
          p.onCardClick(e, false);
        }}
      >
        <div
          class="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full opacity-0 group-hover:opacity-100"
          classList={{
            "bg-primary text-primary-content opacity-100": p.isSelected,
            "border border-base-300 bg-transparent hover:bg-base-300 hover:text-white [&:not(:hover)]:text-transparent":
              !p.isSelected,
          }}
          onClick={(e) => p.onCardClick(e, true)}
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <Show when={pageInputs().status === "loading"}>
          <div
            class="bg-base-200 flex items-center justify-center"
            style={{ "aspect-ratio": "16/9" }}
          >
            <div class="text-sm">Loading...</div>
          </div>
        </Show>
        <Show when={pageInputs().status === "error"}>
          <PageHolder
            pageInputs={undefined}
            pageWidthDu={PAGE_WIDTH_DU}
            pageHeightDu={PAGE_HEIGHT_DU}
            simpleError
            externalError={(pageInputs() as { err: string }).err}
          />
        </Show>
        <Show when={pageInputs().status === "ready"}>
          <PageHolder
            pageInputs={(pageInputs() as { data: PageInputs }).data}
            pageWidthDu={PAGE_WIDTH_DU}
            pageHeightDu={PAGE_HEIGHT_DU}
            simpleError
          />
        </Show>
      </div>
    </div>
  );
}
