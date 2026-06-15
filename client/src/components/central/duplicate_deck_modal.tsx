import { t3, TC } from "platform-lib";
import type { SlideDeckFolder } from "platform-lib";
import {
  AlertFormHolder,
  Button,
  ColorPicker,
  Input,
  Select,
  createFormAction,
  ProgressBar,
  getProgress,
  type AlertComponentProps,
} from "panther";
import { createSignal, Show } from "solid-js";
import { serverActions } from "~/server_actions";

export function DuplicateDeckModal(
  p: AlertComponentProps<
    {
      projectId: string;
      deckDetails: Array<{
        id: string;
        label: string;
        folderId: string | null;
      }>;
      folders: SlideDeckFolder[];
    },
    { lastUpdated: string } | undefined
  >,
) {
  const isBatchMode = () => p.deckDetails.length > 1;

  const [tempLabel, setTempLabel] = createSignal<string>(
    p.deckDetails.length === 1 ? p.deckDetails[0].label : "",
  );
  const [tempFolderId, setTempFolderId] = createSignal<string>(
    p.deckDetails.length === 1 && p.deckDetails[0].folderId
      ? p.deckDetails[0].folderId
      : "_none",
  );

  const [isCreatingFolder, setIsCreatingFolder] = createSignal(false);
  const [newFolderLabel, setNewFolderLabel] = createSignal("");
  const [newFolderColor, setNewFolderColor] = createSignal("#3b82f6");

  const progress = getProgress();

  const folderOptions = () => [
    { value: "_none", label: t3(TC.general) },
    ...p.folders.map((f) => ({ value: f.id, label: f.label })),
  ];

  const save = createFormAction(
    async (e: MouseEvent) => {
      e.preventDefault();

      let folderId: string | null;

      if (isCreatingFolder()) {
        const label = newFolderLabel().trim();
        if (!label) {
          return { success: false, err: t3({ en: "Folder name is required", fr: "Le nom du dossier est requis" }) };
        }

        const createRes = await serverActions.createSlideDeckFolder({
          projectId: p.projectId,
          label,
          color: newFolderColor(),
        });

        if (!createRes.success) {
          return createRes;
        }

        folderId = createRes.data.folderId;
      } else {
        folderId = tempFolderId() === "_none" ? null : tempFolderId();
      }

      const deckCount = p.deckDetails.length;

      if (deckCount === 1) {
        const label = tempLabel().trim();
        if (!label) {
          return { success: false, err: t3(TC.mustEnterName) };
        }

        const dupRes = await serverActions.duplicateSlideDeck({
          projectId: p.projectId,
          deckId: p.deckDetails[0].id,
          label,
          folderId,
        });
        if (!dupRes.success) {
          return dupRes;
        }
        return { success: true, data: { lastUpdated: dupRes.data.lastUpdated } };
      } else {
        let successCount = 0;

        for (let i = 0; i < deckCount; i++) {
          const deck = p.deckDetails[i];

          progress.onProgress(
            i / deckCount,
            `Duplicating deck ${i + 1} of ${deckCount}...`,
          );

          const label = `${deck.label} (copy)`;

          try {
            const dupRes = await serverActions.duplicateSlideDeck({
              projectId: p.projectId,
              deckId: deck.id,
              label,
              folderId,
            });

            if (!dupRes.success) {
              return {
                success: false,
                err: `Failed on deck ${i + 1} of ${deckCount} (${deck.label}): ${dupRes.err}. Created ${successCount} duplicates successfully.`,
              };
            }
            successCount++;
          } catch (err) {
            return {
              success: false,
              err: `Failed on deck ${i + 1} of ${deckCount} (${deck.label}): ${err instanceof Error ? err.message : String(err)}. Created ${successCount} duplicates successfully.`,
            };
          }
        }

        progress.onProgress(1, `Duplicated ${deckCount} decks`);

        return {
          success: true,
          data: { lastUpdated: new Date().toISOString() },
        };
      }
    },
    (data) => {
      if (data) {
        p.close({ lastUpdated: data.lastUpdated });
      }
    },
  );

  const header =
    p.deckDetails.length > 1
      ? `${t3({ en: "Duplicate", fr: "Dupliquer" })} ${p.deckDetails.length} ${t3({ en: "decks", fr: "présentations" })}`
      : t3({ en: "Duplicate slide deck", fr: "Dupliquer la présentation" });

  return (
    <AlertFormHolder
      formId="duplicate-deck"
      header={header}
      savingState={save.state()}
      saveFunc={save.click}
      cancelFunc={() => p.close(undefined)}
      disableSaveButton={
        isCreatingFolder()
          ? !newFolderLabel().trim()
          : !isBatchMode() && !tempLabel().trim()
      }
    >
      <div class="space-y-4">
        <Show when={isBatchMode() && save.state().status === "loading"}>
          <ProgressBar
            progressFrom0To100={progress.progressFrom0To100()}
            progressMsg={progress.progressMsg()}
            small
          />
        </Show>

        <Show when={!isBatchMode()}>
          <Input
            label={t3({ en: "New deck name", fr: "Nom de la nouvelle présentation" })}
            value={tempLabel()}
            onChange={setTempLabel}
            fullWidth
            autoFocus
          />
        </Show>

        <Show
          when={!isCreatingFolder()}
          fallback={
            <div class="space-y-4">
              <div class="flex ui-gap">
                <Input
                  label={t3({ en: "Folder name", fr: "Nom du dossier" })}
                  value={newFolderLabel()}
                  onChange={setNewFolderLabel}
                  autoFocus
                  fullWidth
                />
                <ColorPicker
                  label={t3({ en: "Color", fr: "Couleur" })}
                  value={newFolderColor()}
                  onChange={(c) => setNewFolderColor(c)}
                  position="right"
                />
              </div>
              <Button
                size="sm"
                outline
                onClick={() => setIsCreatingFolder(false)}
              >
                {t3({ en: "Back to folder list", fr: "Retour à la liste des dossiers" })}
              </Button>
            </div>
          }
        >
          <div class="space-y-4">
            <Select
              label={t3(TC.folder)}
              options={folderOptions()}
              value={tempFolderId()}
              onChange={setTempFolderId}
              fullWidth
            />
            <Button
              size="sm"
              outline
              iconName="plus"
              onClick={() => setIsCreatingFolder(true)}
            >
              {t3({ en: "Create new folder", fr: "Créer un nouveau dossier" })}
            </Button>
          </div>
        </Show>
      </div>
    </AlertFormHolder>
  );
}
