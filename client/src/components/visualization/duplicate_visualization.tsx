import { t3, TC } from "platform-lib";
import type { VisualizationFolder } from "platform-lib";
import {
  AlertFormHolder,
  Button,
  ColorPicker,
  Input,
  Select,
  timActionForm,
  ProgressBar,
  getProgress,
  type AlertComponentProps,
} from "panther";
import { createSignal, Show } from "solid-js";
import { serverActions } from "~/server_actions";

export function DuplicateVisualization(
  p: AlertComponentProps<
    {
      projectId: string;
      poDetails: Array<{ id: string; label: string; folderId: string | null }>;
      folders: VisualizationFolder[];
    },
    { lastUpdated: string } | undefined
  >,
) {
  // Temp state

  const isBatchMode = () => p.poDetails.length > 1;

  const [tempLabel, setTempLabel] = createSignal<string>(
    p.poDetails.length === 1 ? p.poDetails[0].label : "",
  );
  const [tempFolderId, setTempFolderId] = createSignal<string>(
    p.poDetails.length === 1 && p.poDetails[0].folderId
      ? p.poDetails[0].folderId
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

  // Actions

  const save = timActionForm(
    async (e: MouseEvent) => {
      e.preventDefault();

      let folderId: string | null;

      // Handle folder creation/selection
      if (isCreatingFolder()) {
        const label = newFolderLabel().trim();
        if (!label) {
          return { success: false, err: "Folder name is required" };
        }

        const createRes = await serverActions.createVisualizationFolder({
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

      // Batch duplication
      const vizCount = p.poDetails.length;

      if (vizCount === 1) {
        // Single duplication
        const label = tempLabel().trim();
        if (!label) {
          return { success: false, err: t3(TC.mustEnterName) };
        }

        const dupRes = await serverActions.duplicatePresentationObject({
          projectId: p.projectId,
          id: p.poDetails[0].id,
          label,
          folderId,
        });
        if (!dupRes.success) {
          return dupRes;
        }
        return { success: true, data: { lastUpdated: new Date().toISOString() } };
      } else {
        // Batch duplication with progress
        let successCount = 0;

        for (let i = 0; i < vizCount; i++) {
          const po = p.poDetails[i];

          progress.onProgress(
            i / vizCount,
            `Duplicating visualization ${i + 1} of ${vizCount}...`,
          );

          const label = `${po.label} (copy)`;

          try {
            const dupRes = await serverActions.duplicatePresentationObject({
              projectId: p.projectId,
              id: po.id,
              label,
              folderId,
            });

            if (!dupRes.success) {
              return {
                success: false,
                err: `Failed on visualization ${i + 1} of ${vizCount} (${po.label}): ${dupRes.err}. Created ${successCount} duplicates successfully.`,
              };
            }
            successCount++;
          } catch (err) {
            return {
              success: false,
              err: `Failed on visualization ${i + 1} of ${vizCount} (${po.label}): ${err instanceof Error ? err.message : String(err)}. Created ${successCount} duplicates successfully.`,
            };
          }
        }

        progress.onProgress(1, `Duplicated ${vizCount} visualizations`);

        return { success: true, data: { lastUpdated: new Date().toISOString() } };
      }
    },
    (data) => {
      if (data) {
        p.close({ lastUpdated: data.lastUpdated });
      }
    },
  );

  const header = p.poDetails.length > 1
    ? t3({ en: `Duplicate ${p.poDetails.length} visualizations`, fr: `Dupliquer ${p.poDetails.length} visualisations` })
    : t3({ en: "Duplicate visualization", fr: "Dupliquer la visualisation" });

  return (
    <AlertFormHolder
      formId="duplicate-presentation-object"
      header={header}
      savingState={save.state()}
      saveFunc={save.click}
      cancelFunc={() => p.close(undefined)}
      disableSaveButton={
        isCreatingFolder()
          ? !newFolderLabel().trim()
          : (!isBatchMode() && !tempLabel().trim())
      }
    >
      <div class="space-y-4">
        {/* Progress bar for batch mode */}
        <Show when={isBatchMode() && save.state().status === "loading"}>
          <ProgressBar
            progressFrom0To100={progress.progressFrom0To100()}
            progressMsg={progress.progressMsg()}
            small
          />
        </Show>

        {/* Label input: only for single viz */}
        <Show when={!isBatchMode()}>
          <Input
            label={t3({ en: "New visualization name", fr: "Nom de la nouvelle visualisation" })}
            value={tempLabel()}
            onChange={setTempLabel}
            fullWidth
            autoFocus
          />
        </Show>

        {/* Folder selection or creation */}
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
