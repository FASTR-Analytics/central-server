import { t3 } from "platform-lib";
import type { SlideDeckFolder } from "platform-lib";
import {
  AlertFormHolder,
  ColorPicker,
  Input,
  timActionForm,
  type AlertComponentProps,
} from "panther";
import { createSignal } from "solid-js";
import { serverActions } from "~/server_actions";

type Props = {
  projectId: string;
  folder?: SlideDeckFolder;
};

type ReturnType = { lastUpdated: string } | undefined;

export function EditDeckFolderModal(p: AlertComponentProps<Props, ReturnType>) {
  const isCreate = !p.folder;
  const [tempLabel, setTempLabel] = createSignal(p.folder?.label ?? "");
  const [tempColor, setTempColor] = createSignal(p.folder?.color ?? "#3b82f6");

  const save = timActionForm(
    async (e: MouseEvent) => {
      e.preventDefault();
      const label = tempLabel().trim();
      if (!label) {
        return { success: false, err: t3({ en: "Folder name is required", fr: "Le nom du dossier est requis" }) };
      }
      if (isCreate) {
        return serverActions.createSlideDeckFolder({
          projectId: p.projectId,
          label,
          color: tempColor(),
        });
      }
      return serverActions.updateSlideDeckFolder({
        projectId: p.projectId,
        folderId: p.folder!.id,
        label,
        color: tempColor(),
      });
    },
    (data) => {
      p.close({ lastUpdated: data.lastUpdated });
    },
  );

  return (
    <AlertFormHolder
      formId="edit-deck-folder"
      header={isCreate ? t3({ en: "New folder", fr: "Nouveau dossier" }) : t3({ en: "Edit folder", fr: "Modifier le dossier" })}
      savingState={save.state()}
      saveFunc={save.click}
      cancelFunc={() => p.close(undefined)}
    >
      <div class="flex ui-gap">
        <Input
          label={t3({ en: "Folder name", fr: "Nom du dossier" })}
          value={tempLabel()}
          onChange={setTempLabel}
          autoFocus
          fullWidth
        />
        <ColorPicker
          label={t3({ en: "Color", fr: "Couleur" })}
          value={tempColor()}
          onChange={(c) => setTempColor(c)}
          position="right"
        />
      </div>
    </AlertFormHolder>
  );
}
