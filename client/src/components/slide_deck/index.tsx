import {
  type SlideDeckConfig,
  getStartingConfigForSlideDeck,
} from "platform-lib";
import {
  getEditorWrapper,
  openComponent,
} from "panther";
import { createSignal, onMount } from "solid-js";
import { serverActions } from "~/server_actions";
import { DownloadSlideDeck } from "./download_slide_deck";
import { SlideEditor } from "./slide_editor";
import { SlideList } from "./slide_list";
import { SlideDeckSettings, type SlideDeckSettingsProps } from "./slide_deck_settings";

export function SlideDeckEditor(p: {
  projectId: string;
  deckId: string;
  onClose: () => void;
}) {
  const { openEditor: openSlideEditor, EditorWrapper: SlideEditorWrapper } = getEditorWrapper();
  const { openEditor: openSettingsEditor, EditorWrapper: SettingsEditorWrapper } = getEditorWrapper();

  const [slideIds, setSlideIds] = createSignal<string[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [selectedSlideIds, setSelectedSlideIds] = createSignal<string[]>([]);
  const [deckLabel, setDeckLabel] = createSignal("");
  const [deckConfig, setDeckConfig] = createSignal<SlideDeckConfig>(
    getStartingConfigForSlideDeck(""),
  );
  const [refreshKey, setRefreshKey] = createSignal(0);

  onMount(async () => {
    const res = await serverActions.getSlideDeckDetail({
      projectId: p.projectId,
      deckId: p.deckId,
    });
    if (res.success) {
      setSlideIds(res.data.slideIds);
      setDeckLabel(res.data.label);
      setDeckConfig(res.data.config);
    }
    setIsLoading(false);
  });

  async function handleOpenSettings() {
    const result = await openSettingsEditor<SlideDeckSettingsProps, "AFTER_DELETE">({
      element: SlideDeckSettings,
      props: {
        projectId: p.projectId,
        config: deckConfig(),
        heading: "Slide deck settings",
        nameLabel: "Slide deck name",
        showPageNumbersSuffix: "(except on cover and section slides)",
        saveConfig: (config) =>
          serverActions.updateSlideDeckConfig({
            projectId: p.projectId,
            deckId: p.deckId,
            config,
          }),
        onSaved: async () => {
          const res = await serverActions.getSlideDeckDetail({
            projectId: p.projectId,
            deckId: p.deckId,
          });
          if (res.success) {
            setDeckLabel(res.data.label);
            setDeckConfig(res.data.config);
            setSlideIds(res.data.slideIds);
          }
        },
        deleteAction: {
          confirmText: "Are you sure you want to delete this slide deck?",
          itemLabel: deckLabel(),
          deleteButtonLabel: "Delete slide deck",
          onDelete: () =>
            serverActions.deleteSlideDeck({ projectId: p.projectId, deckId: p.deckId }),
        },
      },
    });
    if (result === "AFTER_DELETE") {
      p.onClose();
    }
  }

  async function download() {
    await openComponent({
      element: DownloadSlideDeck,
      props: { projectId: p.projectId, deckId: p.deckId },
    });
  }

  async function handleEditSlide(slideId: string) {
    const res = await serverActions.getSlide({ projectId: p.projectId, slideId });
    if (!res.success) return;

    await openSlideEditor({
      element: SlideEditor,
      props: {
        projectId: p.projectId,
        deckId: p.deckId,
        deckLabel: deckLabel(),
        slideId,
        slide: res.data.slide,
        lastUpdated: res.data.lastUpdated,
        deckConfigSnapshot: deckConfig(),
      },
    });

    setRefreshKey((k) => k + 1);
  }

  return (
    <SettingsEditorWrapper>
      <SlideEditorWrapper>
        <SlideList
          projectId={p.projectId}
          deckId={p.deckId}
          slideIds={slideIds()}
          isLoading={isLoading()}
          deckLabel={deckLabel()}
          deckConfig={deckConfig()}
          setSelectedSlideIds={setSelectedSlideIds}
          onEditSlide={handleEditSlide}
          handleClose={async () => p.onClose()}
          handleOpenSettings={handleOpenSettings}
          download={download}
          refreshKey={refreshKey()}
        />
      </SlideEditorWrapper>
    </SettingsEditorWrapper>
  );
}
