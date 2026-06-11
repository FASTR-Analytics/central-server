import { t3, TC } from "platform-lib";
import type { SlideDeckFolder, SlideDeckGroupingMode, SlideDeckSummary } from "platform-lib";
import {
  Button,
  createSelectionController,
  FrameLeftResizable,
  getColor,
  HeadingBar,
  openComponent,
  PageHolder,
  Select,
  SelectionCircle,
  SelectList,
  showMenu,
  timActionDelete,
  getQueryStateFromApiResponse,
  type ListItem,
  type MenuItem,
  type PageInputs,
  type StateHolder,
} from "panther";
import {
  PAGE_HEIGHT_DU,
  PAGE_WIDTH_DU,
  type SlideDeckConfig,
  getStartingConfigForSlideDeck,
} from "platform-lib";
import { createEffect, createSignal, For, Show } from "solid-js";
import { convertSlideToPageInputs } from "~/generate_slide_deck/convert_slide_to_page_inputs";
import { serverActions } from "~/server_actions";
import { projectState } from "~/state/project/t1_store";
import {
  deckGroupingMode,
  setDeckGroupingMode,
  deckSelectedGroup,
  setDeckSelectedGroup,
} from "~/state/ui";
import { AddDeckForm } from "./add_deck";
import { EditDeckFolderModal } from "./edit_deck_folder_modal";
import { MoveDeckToFolderModal } from "./move_deck_to_folder_modal";
import { DuplicateDeckModal } from "./duplicate_deck_modal";

function getGroupingOptions(): { value: SlideDeckGroupingMode; label: string }[] {
  return [
    { value: "folders", label: t3({ en: "By folder", fr: "Par dossier" }) },
    { value: "flat", label: t3({ en: "Flat list", fr: "Liste simple" }) },
  ];
}

type GroupOption = {
  value: string;
  label: string;
  count: number;
  color?: string | null;
};

type Props = {
  projectId: string;
  canConfigure: boolean;
  onOpenEditor: (id: string) => void;
};

export function SlideDecksList(p: Props) {
  const [searchText, setSearchText] = createSignal<string>("");

  async function attemptAddDeck() {
    const group = deckSelectedGroup();
    const currentFolderId =
      deckGroupingMode() === "folders" && group && !group.startsWith("_")
        ? group
        : null;
    const res = await openComponent({
      element: AddDeckForm,
      props: {
        projectId: p.projectId,
        folders: projectState.slideDeckFolders,
        currentFolderId,
      },
    });
    if (res === undefined) {
      return;
    }
    p.onOpenEditor(res.newDeckId);
  }

  return (
    <div class="flex h-full w-full min-w-0 flex-col">
      <HeadingBar
        heading={t3({ en: "Slide decks", fr: "Présentations" })}
        searchText={searchText()}
        setSearchText={setSearchText}
        class="border-base-300"
        ensureHeightAsIfButton
      >
        <Show when={p.canConfigure}>
          <Button intent="primary" iconName="plus" size="sm" onClick={attemptAddDeck}>
            {t3({ en: "Create slide deck", fr: "Créer une présentation" })}
          </Button>
        </Show>
      </HeadingBar>
      <div class="min-h-0 w-full flex-1">
        <SlideDecksPanelDisplay
          projectId={p.projectId}
          decks={projectState.slideDecks}
          folders={projectState.slideDeckFolders}
          searchText={searchText().trim()}
          canConfigure={p.canConfigure}
          onOpenEditor={p.onOpenEditor}
        />
      </div>
    </div>
  );
}

type PanelProps = {
  projectId: string;
  decks: SlideDeckSummary[];
  folders: SlideDeckFolder[];
  searchText: string;
  canConfigure: boolean;
  onOpenEditor: (id: string) => void;
};

function SlideDecksPanelDisplay(p: PanelProps) {
  function openDeck(deckId: string) {
    p.onOpenEditor(deckId);
  }

  const filteredBySearch = () => {
    const decks = p.decks;
    if (p.searchText.length < 3) return decks;
    const searchLower = p.searchText.toLowerCase();
    return decks.filter((d) => d.label.toLowerCase().includes(searchLower));
  };

  const groupOptions = (): GroupOption[] => {
    const decks = filteredBySearch();
    const mode = deckGroupingMode();

    switch (mode) {
      case "folders": {
        const generalCount = decks.filter((d) => d.folderId === null).length;
        const groups: GroupOption[] = [
          { value: "_unfiled", label: t3(TC.general), count: generalCount },
        ];
        groups.push(
          ...p.folders.map((f) => ({
            value: f.id,
            label: f.label,
            count: decks.filter((d) => d.folderId === f.id).length,
            color: f.color,
          })),
        );
        return groups;
      }
      case "flat":
        return [
          { value: "_all", label: t3({ en: "All slide decks", fr: "Toutes les présentations" }), count: decks.length },
        ];
      default:
        return [];
    }
  };

  const filteredDecks = () => {
    const decks = filteredBySearch();
    const group = deckSelectedGroup();
    const mode = deckGroupingMode();

    if (!group) return [];

    switch (mode) {
      case "folders":
        if (group === "_unfiled") {
          return decks.filter((d) => d.folderId === null);
        }
        return decks.filter((d) => d.folderId === group);
      case "flat":
        return [...decks].sort((a, b) => a.label.localeCompare(b.label));
      default:
        return decks;
    }
  };

  createEffect(() => {
    deckGroupingMode();
    const groups = groupOptions();
    const current = deckSelectedGroup();
    if (groups.length > 0 && !groups.find((g) => g.value === current)) {
      setDeckSelectedGroup(groups[0].value);
    }
  });

  const selection = createSelectionController<string>({
    ids: () => filteredDecks().map((d) => d.id),
    mode: "multi",
  });

  // Batch operation handlers

  async function handleMoveToFolder(deck: SlideDeckSummary) {
    const idsToMove = selection.getBatchIds(deck.id);

    await openComponent({
      element: MoveDeckToFolderModal,
      props: {
        projectId: p.projectId,
        deckIds: idsToMove,
        currentFolderId: deck.folderId,
        folders: p.folders,
      },
    });

    selection.clear();
  }

  async function handleDuplicate(deck: SlideDeckSummary) {
    const idsToDuplicate = selection.getBatchIds(deck.id);

    const deckDetails = idsToDuplicate
      .map((id) => p.decks.find((d) => d.id === id))
      .filter((d): d is SlideDeckSummary => d !== undefined)
      .map((d) => ({ id: d.id, label: d.label, folderId: d.folderId }));

    await openComponent({
      element: DuplicateDeckModal,
      props: {
        projectId: p.projectId,
        deckDetails,
        folders: p.folders,
      },
    });

    selection.clear();
  }

  async function handleDelete(deck: SlideDeckSummary) {
    const idsToDelete = selection.getBatchIds(deck.id);

    const confirmText =
      idsToDelete.length > 1
        ? t3({ en: `Are you sure you want to delete ${idsToDelete.length} slide decks?`, fr: `Êtes-vous sûr de vouloir supprimer ${idsToDelete.length} présentations ?` })
        : t3({ en: "Are you sure you want to delete this slide deck?", fr: "Êtes-vous sûr de vouloir supprimer cette présentation ?" });

    const deleteAction = timActionDelete(
      confirmText,
      async () => {
        const promises = idsToDelete.map((id) =>
          serverActions.deleteSlideDeck({
            projectId: p.projectId,
            deckId: id,
          }),
        );
        const results = await Promise.all(promises);
        const failed = results.filter((r) => !r.success);
        if (failed.length > 0) {
          return failed[0];
        }
        return results[0];
      },
      () => {
        selection.clear();
        // SSE will handle refresh
      },
    );
    await deleteAction.click();
  }

  function handleContextMenu(e: MouseEvent, deck: SlideDeckSummary) {
    e.preventDefault();

    if (!p.canConfigure) return;

    const isMultiSelect =
      selection.isSelected(deck.id) && selection.selectedCount() > 1;
    const count = selection.selectedCount();

    const items: MenuItem[] = [
      {
        label: isMultiSelect
          ? t3({ en: `Move ${count} decks to folder...`, fr: `Déplacer ${count} présentations vers un dossier...` })
          : t3({ en: "Move to folder...", fr: "Déplacer vers un dossier..." }),
        icon: "folder",
        onClick: () => handleMoveToFolder(deck),
      },
      {
        label: isMultiSelect
          ? t3({ en: `Duplicate ${count} decks...`, fr: `Dupliquer ${count} présentations...` })
          : t3({ en: "Duplicate...", fr: "Dupliquer..." }),
        icon: "copy",
        onClick: () => handleDuplicate(deck),
      },
      {
        label: isMultiSelect
          ? t3({ en: `Delete ${count} decks`, fr: `Supprimer ${count} présentations` })
          : t3(TC.delete),
        icon: "trash",
        intent: "danger",
        onClick: () => handleDelete(deck),
      },
    ];
    showMenu({ anchor: { x: e.clientX, y: e.clientY, width: 0, height: 0 }, items });
  }

  // Folder context menu

  function handleFolderContextMenu(e: MouseEvent, folderId: string) {
    e.preventDefault();
    e.stopPropagation();
    const folder = p.folders.find((f) => f.id === folderId);
    if (!folder) return;

    const items: MenuItem[] = [
      {
        label: t3({ en: "Rename / Change color...", fr: "Renommer / Changer la couleur..." }),
        icon: "pencil",
        onClick: async () => {
          await openComponent({
            element: EditDeckFolderModal,
            props: {
              projectId: p.projectId,
              folder,
            },
          });
        },
      },
      {
        label: t3({ en: "Delete folder", fr: "Supprimer le dossier" }),
        icon: "trash",
        intent: "danger",
        onClick: async () => {
          const deleteAction = timActionDelete(
            t3({ en: "Are you sure you want to delete this folder? Slide decks will be moved to General.", fr: "Êtes-vous sûr de vouloir supprimer ce dossier ? Les présentations seront déplacées dans Général." }),
            () =>
              serverActions.deleteSlideDeckFolder({
                projectId: p.projectId,
                folderId,
              }),
            () => {},
          );
          await deleteAction.click();
        },
      },
    ];
    showMenu({ anchor: { x: e.clientX, y: e.clientY, width: 0, height: 0 }, items });
  }

  const renderGroupOption = (item: ListItem<string>) => {
    const opt = groupOptions().find((g) => g.value === item.id);
    if (!opt) return <span>{item.label}</span>;

    const mode = deckGroupingMode();
    if (mode === "folders") {
      const isUserFolder = !item.id.startsWith("_");
      return (
        <div
          class="flex items-center gap-2"
          onContextMenu={
            isUserFolder && p.canConfigure
              ? (e) => handleFolderContextMenu(e, item.id)
              : undefined
          }
        >
          <div
            class="h-2.5 w-2.5 flex-none rounded-full"
            style={{
              "background-color": opt.color ?? getColor({ key: "base300" }),
            }}
          />
          <span class="flex-1 truncate">{opt.label}</span>
          <span class="text-neutral text-xs">({opt.count})</span>
        </div>
      );
    }
    return (
      <div class="flex items-center justify-between gap-2">
        <span class="truncate">{opt.label}</span>
        <span class="text-neutral text-xs">({opt.count})</span>
      </div>
    );
  };

  return (
    <FrameLeftResizable
      startingWidth={180}
      minWidth={170}
      maxWidth={300}
      hoverOffset="offset-for-border-1-on-left"
      panelChildren={
        <div class="border-base-300 flex h-full w-full flex-col border-r">
          <div class="border-base-300 border-b p-3">
            <Select
              options={getGroupingOptions()}
              value={deckGroupingMode()}
              onChange={(v) =>
                setDeckGroupingMode(v as SlideDeckGroupingMode)
              }
              fullWidth
            />
          </div>
          <div class="flex-1 overflow-auto p-2">
            <SelectList
              items={groupOptions().map((g) => ({
                id: g.value,
                label: g.label,
              }))}
              value={deckSelectedGroup() ?? undefined}
              onChange={setDeckSelectedGroup}
              renderItem={renderGroupOption}
              fullWidth
            />
            <Show when={deckGroupingMode() === "folders" && p.canConfigure}>
              <div class="py-3">
                <Button
                  size="sm"
                  outline
                  iconName="plus"
                  onClick={async () => {
                    await openComponent({
                      element: EditDeckFolderModal,
                      props: { projectId: p.projectId },
                    });
                  }}
                >
                  {t3({ en: "New folder", fr: "Nouveau dossier" })}
                </Button>
              </div>
            </Show>
          </div>
        </div>
      }
    >
      <div
        class="ui-gap ui-pad grid h-full w-full grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] content-start items-start overflow-auto"
        onClick={() => selection.clear()}
      >
        <For
          each={filteredDecks()}
          fallback={
            <div class="text-neutral text-sm">
              {p.searchText.length >= 3
                ? t3({ en: "No matching decks", fr: "Aucune présentation correspondante" })
                : t3({ en: "No slide decks yet", fr: "Aucune présentation pour le moment" })}
            </div>
          }
        >
          {(deck) => {
            const isSelected = () => selection.isSelected(deck.id);
            return (
              <div class="group grid grid-rows-subgrid row-span-2 gap-y-1">
                <div class="font-400 text-base-content text-xs italic select-none pointer-events-none pb-1">
                  {deck.label}
                </div>
                <div
                  class="relative border rounded overflow-clip bg-white cursor-pointer"
                  classList={{
                    "border-base-300": !isSelected(),
                    "border-primary": isSelected(),
                    "hover:border-primary": !isSelected(),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selection.handleClick(deck.id, e, () => openDeck(deck.id));
                  }}
                  onContextMenu={(e) => handleContextMenu(e, deck)}
                >
                  <SelectionCircle
                    isSelected={isSelected()}
                    onClick={(e) => selection.handleClick(deck.id, e)}
                  />
                  <Show
                    when={deck.firstSlideId}
                    fallback={
                      <div
                        class="bg-base-200 flex items-center justify-center"
                        style={{ "aspect-ratio": "16/9" }}
                      >
                        <span class="text-neutral text-xs">{t3({ en: "No slides", fr: "Aucune diapositive" })}</span>
                      </div>
                    }
                  >
                    <SlideDeckThumbnail
                      projectId={p.projectId}
                      deck={deck}
                    />
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </FrameLeftResizable>
  );
}

const _defaultConfig = getStartingConfigForSlideDeck("");

function SlideDeckThumbnail(p: {
  projectId: string;
  deck: SlideDeckSummary;
}) {
  const [pageInputs, setPageInputs] = createSignal<StateHolder<PageInputs>>({
    status: "loading",
    msg: "Loading...",
  });

  createEffect(async () => {
    const slideId = p.deck.firstSlideId;
    const config: SlideDeckConfig = p.deck.config ?? _defaultConfig;

    if (!slideId) {
      setPageInputs({ status: "error", err: "No slides" });
      return;
    }

    setPageInputs({ status: "loading", msg: "Loading..." });
    const res = await serverActions.getSlide({ projectId: p.projectId, slideId });
    if (!res.success) {
      setPageInputs({ status: "error", err: res.err });
      return;
    }

    const renderRes = await convertSlideToPageInputs(
      p.projectId,
      res.data.slide,
      0,
      config,
    );
    setPageInputs(getQueryStateFromApiResponse(renderRes));
  });

  return (
    <div class="bg-base-200 aspect-video w-full overflow-hidden">
      <Show
        when={pageInputs().status !== "loading" && pageInputs().status !== "error"}
        fallback={
          <div class="text-base-content/40 flex h-full items-center justify-center text-xs">
            <Show
              when={pageInputs().status === "loading"}
              fallback={<span>No preview</span>}
            >
              <span>Loading...</span>
            </Show>
          </div>
        }
      >
        <PageHolder
          pageInputs={(pageInputs() as { data: PageInputs }).data}
          pageWidthDu={PAGE_WIDTH_DU}
          pageHeightDu={PAGE_HEIGHT_DU}
          simpleError
        />
      </Show>
    </div>
  );
}
