import {
  type Slide,
  type SlideDeckConfig,
  getDefaultCoverSlide,
  getDefaultSectionSlide,
  getDefaultContentSlide,
} from "platform-lib";
import {
  Button,
  FrameTop,
  HeadingBar,
  Loading,
  type MenuItem,
  MenuTriggerWrapper,
  Slider,
  timActionDelete,
} from "panther";
import SortableVendor, {
  SortableJs,
} from "../../../../../platform/panther/_303_components/form_inputs/solid_sortablejs_vendored.tsx";
import { createEffect, createSignal, on, Show } from "solid-js";
import { serverActions } from "~/server_actions";
import { SlideCard } from "./slide_card";

type Props = {
  projectId: string;
  deckId: string;
  slideIds: string[];
  isLoading: boolean;
  deckLabel: string;
  setSelectedSlideIds: (ids: string[]) => void;
  onEditSlide: (slideId: string) => Promise<void>;
  handleClose: () => Promise<void>;
  handleOpenSettings: () => Promise<void>;
  download: () => Promise<void>;
  deckConfig: SlideDeckConfig;
  refreshKey: number;
};

export function SlideList(p: Props) {
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = createSignal<number | null>(null);
  const [slideSize, setSlideSize] = createSignal(400);
  const [isFillWidth, setIsFillWidth] = createSignal(false);

  function updateSelection(newSelected: Set<string>) {
    setSelectedIds(newSelected);
    p.setSelectedSlideIds(Array.from(newSelected));
  }

  function clearSelection() {
    setSelectedIds(new Set<string>());
    setLastSelectedIndex(null);
    p.setSelectedSlideIds([]);
    document.querySelectorAll(".sortable-selected").forEach((el) => {
      SortableJs.utils.deselect(el);
    });
  }

  const [sortableSlideItems, setSortableSlideItems] = createSignal<{ id: string }[]>(
    p.slideIds.map((id) => ({ id })),
  );

  createEffect(
    on(
      () => p.slideIds,
      (slideIds) => {
        const currentItems = sortableSlideItems();
        const currentIds = new Set(currentItems.map((i) => i.id));
        const newIds = new Set(slideIds);

        const setChanged =
          currentIds.size !== newIds.size || !slideIds.every((id) => currentIds.has(id));
        const orderChanged = !currentItems.every((item, i) => item.id === slideIds[i]);

        if (setChanged || orderChanged) {
          setSortableSlideItems(slideIds.map((id) => ({ id })));
        }
      },
    ),
  );

  function handleSlideClick(
    index: number,
    slideId: string,
    event: MouseEvent,
    isCircleClick: boolean,
  ) {
    if (isCircleClick) {
      event.stopPropagation();

      if (event.metaKey || event.ctrlKey) {
        const newSelected = new Set(selectedIds());
        if (newSelected.has(slideId)) newSelected.delete(slideId);
        else newSelected.add(slideId);
        updateSelection(newSelected);
        setLastSelectedIndex(index);
        syncSelectionWithSortableJS(newSelected);
        return;
      }

      if (event.shiftKey && lastSelectedIndex() !== null) {
        event.preventDefault();
        const newSelected = new Set(selectedIds());
        const start = Math.min(lastSelectedIndex()!, index);
        const end = Math.max(lastSelectedIndex()!, index);
        const items = sortableSlideItems();
        for (let i = start; i <= end; i++) newSelected.add(items[i].id);
        updateSelection(newSelected);
        syncSelectionWithSortableJS(newSelected);
        return;
      }

      const currentlySelected = selectedIds();
      let newSelected: Set<string>;
      if (currentlySelected.has(slideId)) {
        newSelected = new Set(currentlySelected);
        newSelected.delete(slideId);
      } else {
        newSelected = new Set([slideId]);
      }
      setSelectedIds(newSelected);
      p.setSelectedSlideIds(Array.from(newSelected));
      setLastSelectedIndex(index);
      syncSelectionWithSortableJS(newSelected);
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      const newSelected = new Set(selectedIds());
      if (newSelected.has(slideId)) newSelected.delete(slideId);
      else newSelected.add(slideId);
      setSelectedIds(newSelected);
      p.setSelectedSlideIds(Array.from(newSelected));
      setLastSelectedIndex(index);
      syncSelectionWithSortableJS(newSelected);
      return;
    }

    if (event.shiftKey && lastSelectedIndex() !== null) {
      event.preventDefault();
      const newSelected = new Set(selectedIds());
      const start = Math.min(lastSelectedIndex()!, index);
      const end = Math.max(lastSelectedIndex()!, index);
      const items = sortableSlideItems();
      for (let i = start; i <= end; i++) newSelected.add(items[i].id);
      setSelectedIds(newSelected);
      p.setSelectedSlideIds(Array.from(newSelected));
      syncSelectionWithSortableJS(newSelected);
      return;
    }

    clearSelection();
    p.onEditSlide(slideId);
  }

  function syncSelectionWithSortableJS(selectedSet: Set<string>) {
    document.querySelectorAll(".slide-card-wrapper").forEach((el) => {
      const parent = el.parentElement;
      if (!parent) return;
      const slideId = parent.dataset.id;
      if (!slideId) return;
      if (selectedSet.has(slideId)) {
        if (!parent.classList.contains("sortable-selected"))
          parent.classList.add("sortable-selected");
      } else {
        if (parent.classList.contains("sortable-selected"))
          parent.classList.remove("sortable-selected");
      }
    });
  }

  async function handleDelete(slideId: string) {
    const selected = selectedIds();
    const isSlideSelected = selected.has(slideId);
    const shouldDeleteMultiple = isSlideSelected && selected.size > 1;
    const slideIdsToDelete = shouldDeleteMultiple ? Array.from(selected) : [slideId];
    const confirmText =
      slideIdsToDelete.length > 1
        ? `Are you sure you want to delete ${slideIdsToDelete.length} slides?`
        : "Are you sure you want to delete this slide?";

    const deleteAction = timActionDelete(
      confirmText,
      () =>
        serverActions.deleteSlides({
          projectId: p.projectId,
          deckId: p.deckId,
          slideIds: slideIdsToDelete,
        }),
      () => {
        setSortableSlideItems((items) => items.filter((i) => !slideIdsToDelete.includes(i.id)));
        clearSelection();
      },
    );
    await deleteAction.click();
  }

  async function handleDuplicate(slideId: string) {
    const selected = selectedIds();
    const isSlideSelected = selected.has(slideId);
    const shouldDuplicateMultiple = isSlideSelected && selected.size > 1;
    const slideIdsToDuplicate = shouldDuplicateMultiple ? Array.from(selected) : [slideId];

    const res = await serverActions.duplicateSlides({
      projectId: p.projectId,
      deckId: p.deckId,
      slideIds: slideIdsToDuplicate,
    });

    if (res.success) {
      setSortableSlideItems((currentItems) => {
        const newItems = [...currentItems];
        let lastOriginalIndex = -1;
        for (const originalId of slideIdsToDuplicate) {
          const idx = newItems.findIndex((item) => item.id === originalId);
          if (idx > lastOriginalIndex) lastOriginalIndex = idx;
        }
        if (lastOriginalIndex !== -1) {
          const newSlideItems = res.data.newSlideIds.map((id) => ({ id }));
          newItems.splice(lastOriginalIndex + 1, 0, ...newSlideItems);
        }
        return newItems;
      });
    }
  }

  async function handleReorder(oldSlideIds: string[], newSlideIds: string[]) {
    if (newSlideIds.length !== oldSlideIds.length) return;
    if (newSlideIds.every((id, i) => id === oldSlideIds[i])) return;

    const movedIds: string[] = [];
    let targetPosition:
      | { after: string }
      | { before: string }
      | { toStart: true }
      | { toEnd: true }
      | null = null;

    for (let i = 0; i < newSlideIds.length; i++) {
      const slideAtNewPos = newSlideIds[i];
      const slideAtOldPos = oldSlideIds[i];

      if (slideAtNewPos !== slideAtOldPos) {
        const oldIndex = oldSlideIds.indexOf(slideAtNewPos);
        if (oldIndex !== i) {
          let j = i;
          while (
            j < newSlideIds.length &&
            oldSlideIds.indexOf(newSlideIds[j]) !== j
          ) {
            movedIds.push(newSlideIds[j]);
            j++;
          }

          if (i === 0) targetPosition = { toStart: true };
          else targetPosition = { after: newSlideIds[i - 1] };
          break;
        }
      }
    }

    if (movedIds.length === 0 || !targetPosition) return;

    await serverActions.moveSlides({
      projectId: p.projectId,
      deckId: p.deckId,
      slideIds: movedIds,
      position: targetPosition,
    });
  }

  function getInsertPosition(): { after: string } | { toEnd: true } {
    const items = sortableSlideItems();
    const selected = selectedIds();
    if (selected.size > 0) {
      let maxIndex = -1;
      let afterSlideId = "";
      for (const id of selected) {
        const idx = items.findIndex((i) => i.id === id);
        if (idx > maxIndex) {
          maxIndex = idx;
          afterSlideId = id;
        }
      }
      if (afterSlideId) return { after: afterSlideId };
    }
    return { toEnd: true };
  }

  async function addSlide(slide: Slide) {
    const position = getInsertPosition();
    const afterSlideId = "after" in position ? position.after : null;

    const res = await serverActions.createSlide({
      projectId: p.projectId,
      deckId: p.deckId,
      position,
      slide,
    });

    if (res.success) {
      setSortableSlideItems((currentItems) => {
        if (afterSlideId === null) return [...currentItems, { id: res.data.slideId }];
        const afterIndex = currentItems.findIndex((i) => i.id === afterSlideId);
        if (afterIndex === -1) return [...currentItems, { id: res.data.slideId }];
        const newItems = [...currentItems];
        newItems.splice(afterIndex + 1, 0, { id: res.data.slideId });
        return newItems;
      });
    }
  }

  const addSlideMenuItems = (): MenuItem[] => [
    { label: "Cover slide", icon: "plus", onClick: () => addSlide(getDefaultCoverSlide()) },
    { label: "Section slide", icon: "plus", onClick: () => addSlide(getDefaultSectionSlide()) },
    { label: "Content slide", icon: "plus", onClick: () => addSlide(getDefaultContentSlide()) },
  ];

  const menuItems = (): MenuItem[] => [
    { label: "Download", icon: "download", onClick: () => p.download() },
  ];

  return (
    <FrameTop
      panelChildren={
        <HeadingBar
          heading={p.deckLabel}
          leftChildren={<Button iconName="chevronLeft" onClick={() => p.handleClose()} />}
        >
          <div class="flex items-center ui-gap-sm">
            <Show when={p.slideIds.length > 0}>
              <div class="w-32">
                <Slider
                  value={slideSize()}
                  onChange={setSlideSize}
                  min={200}
                  max={800}
                  step={50}
                  fullWidth
                  disabled={isFillWidth()}
                />
              </div>
              <Button
                iconName={isFillWidth() ? "minimize" : "maximize"}
                outline
                onClick={() => setIsFillWidth(!isFillWidth())}
              />
            </Show>
            <MenuTriggerWrapper position="bottom-end" items={addSlideMenuItems()}>
              <Button iconName="plus">Add slide</Button>
            </MenuTriggerWrapper>
            <Button iconName="settings" outline onClick={() => p.handleOpenSettings()}>
              Settings
            </Button>
            <MenuTriggerWrapper position="bottom-end" items={menuItems()}>
              <Button iconName="moreVertical" outline />
            </MenuTriggerWrapper>
          </div>
        </HeadingBar>
      }
    >
      <div
        class="h-full w-full overflow-auto ui-pad bg-base-200"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const clickedOnSlide = target.closest(".slide-card-wrapper");
          if (!clickedOnSlide) clearSelection();
        }}
      >
        <Show when={p.isLoading}>
          <Loading msg="Loading slides..." noPad />
        </Show>
        <Show when={!p.isLoading && p.slideIds.length === 0}>
          <div class="text-neutral w-full py-16 text-center">
            No slides yet. Click "Add slide" to create your first slide.
          </div>
        </Show>
        <Show when={!p.isLoading && p.slideIds.length > 0}>
          <SortableVendor
            idField="id"
            items={sortableSlideItems()}
            setItems={(newItems: { id: string }[]) => {
              const oldItems = sortableSlideItems();
              setSortableSlideItems(newItems);
              handleReorder(
                oldItems.map((i) => i.id),
                newItems.map((i) => i.id),
              );
            }}
            class="flex flex-wrap justify-center gap-4"
            multiDrag
            avoidImplicitDeselect
            selectedClass="sortable-selected"
            animation={150}
            ghostClass="opacity-50"
            chosenClass="shadow-2xl"
            dragClass="cursor-grabbing"
            fallbackTolerance={3}
          >
            {(item: { id: string }) => {
              const index = () => sortableSlideItems().findIndex((i) => i.id === item.id);
              return (
                <SlideCard
                  projectId={p.projectId}
                  deckId={p.deckId}
                  slideId={item.id}
                  index={index()}
                  isSelected={selectedIds().has(item.id)}
                  selectedCount={selectedIds().size}
                  slideSize={slideSize()}
                  fillWidth={isFillWidth()}
                  onCardClick={(e, isCircleClick) =>
                    handleSlideClick(index(), item.id, e, isCircleClick)
                  }
                  onEdit={() => {
                    clearSelection();
                    p.onEditSlide(item.id);
                  }}
                  onDelete={() => handleDelete(item.id)}
                  onDuplicate={() => handleDuplicate(item.id)}
                  deckConfig={p.deckConfig}
                  refreshKey={p.refreshKey}
                />
              );
            }}
          </SortableVendor>
        </Show>
      </div>
    </FrameTop>
  );
}
