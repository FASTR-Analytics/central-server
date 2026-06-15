import { t3, TC } from "platform-lib";
import type { VisualizationFolder } from "platform-lib";
import {
  AlertFormHolder,
  Button,
  ColorPicker,
  Input,
  RadioGroup,
  createFormAction,
  type AlertComponentProps,
} from "panther";
import { createSignal, Show } from "solid-js";
import { serverActions } from "~/server_actions";

type Props = {
  projectId: string;
  presentationObjectIds: string[];
  currentFolderId: string | null;
  folders: VisualizationFolder[];
};

type ReturnType = { lastUpdated: string } | undefined;

export function MoveToFolderModal(p: AlertComponentProps<Props, ReturnType>) {
  const [selectedFolderId, setSelectedFolderId] = createSignal<string | null>(
    p.currentFolderId,
  );
  const [isCreatingFolder, setIsCreatingFolder] = createSignal(false);
  const [newFolderLabel, setNewFolderLabel] = createSignal("");
  const [newFolderColor, setNewFolderColor] = createSignal("#3b82f6");

  const folderOptions = () => [
    { value: "_none", label: t3(TC.general) },
    ...p.folders.map((f) => ({
      value: f.id,
      label: f.label,
    })),
  ];

  const save = createFormAction(
    async (e: MouseEvent) => {
      e.preventDefault();

      if (isCreatingFolder()) {
        const label = newFolderLabel().trim();
        if (!label) {
          return { success: false, err: t3({ en: "Folder name is required", fr: "Le nom du dossier est requis" }) };
        }

        const createRes = await serverActions.createVisualizationFolder({
          projectId: p.projectId,
          label,
          color: newFolderColor(),
        });

        if (!createRes.success) {
          return createRes;
        }

        const promises = p.presentationObjectIds.map((id) =>
          serverActions.updatePresentationObjectFolder({
            projectId: p.projectId,
            id,
            folderId: createRes.data.folderId,
          }),
        );
        const results = await Promise.all(promises);
        const failed = results.filter((r) => !r.success);
        if (failed.length > 0) {
          return failed[0];
        }
        return results[0];
      }

      const folderId = selectedFolderId() === "_none" ? null : selectedFolderId();

      if (folderId === p.currentFolderId) {
        p.close(undefined);
        return { success: true, data: { lastUpdated: "" } };
      }

      const promises = p.presentationObjectIds.map((id) =>
        serverActions.updatePresentationObjectFolder({
          projectId: p.projectId,
          id,
          folderId,
        }),
      );
      const results = await Promise.all(promises);
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        return failed[0];
      }
      return results[0];
    },
    (data) => {
      p.close({ lastUpdated: data.lastUpdated });
    },
  );

  const header = p.presentationObjectIds.length > 1
    ? `${t3({ en: "Move", fr: "Déplacer" })} ${p.presentationObjectIds.length} ${t3({ en: "visualizations to folder", fr: "visualisations vers le dossier" })}`
    : t3({ en: "Move to folder", fr: "Déplacer vers le dossier" });

  return (
    <AlertFormHolder
      formId="move-to-folder"
      header={header}
      savingState={save.state()}
      saveFunc={save.click}
      cancelFunc={() => p.close(undefined)}
      disableSaveButton={isCreatingFolder() && !newFolderLabel().trim()}
    >
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
          <RadioGroup
            label={t3({ en: "Select folder", fr: "Sélectionner le dossier" })}
            options={folderOptions()}
            value={selectedFolderId() ?? "_none"}
            onChange={(v) => setSelectedFolderId(v === "_none" ? null : v)}
            convertToSelectThreshold={6}
            fullWidthForSelect
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
    </AlertFormHolder>
  );
}
