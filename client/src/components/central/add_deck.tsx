import { t3, TC } from "platform-lib";
import type { SlideDeckFolder } from "platform-lib";
import {
  AlertFormHolder,
  Input,
  Select,
  timActionForm,
  type AlertComponentProps,
} from "panther";
import { createSignal } from "solid-js";
import { serverActions } from "~/server_actions";

export function AddDeckForm(
  p: AlertComponentProps<
    { projectId: string; folders: SlideDeckFolder[]; currentFolderId: string | null },
    { newDeckId: string }
  >,
) {
  const [tempLabel, setTempLabel] = createSignal<string>("");
  const [tempFolderId, setTempFolderId] = createSignal<string>(
    p.currentFolderId ?? "_none",
  );

  const folderOptions = () => [
    { value: "_none", label: t3(TC.general) },
    ...p.folders.map((f) => ({ value: f.id, label: f.label })),
  ];

  const save = timActionForm(
    async (e: MouseEvent) => {
      e.preventDefault();
      if (!tempLabel().trim()) {
        return { success: false, err: t3({ en: "You must enter a label", fr: "Vous devez saisir un libellé" }) };
      }
      const folderId = tempFolderId() === "_none" ? null : tempFolderId();
      return await serverActions.createSlideDeck({
        projectId: p.projectId,
        label: tempLabel().trim(),
        folderId,
      });
    },
    (data) => p.close({ newDeckId: data.deckId }),
  );

  return (
    <AlertFormHolder
      formId="add-deck"
      header={t3({ en: "Create slide deck", fr: "Créer une présentation" })}
      savingState={save.state()}
      saveFunc={save.click}
      cancelFunc={() => p.close(undefined)}
    >
      <div class="ui-spy">
        <Input
          label={t3({ en: "Deck name", fr: "Nom de la présentation" })}
          value={tempLabel()}
          onChange={setTempLabel}
          fullWidth
          autoFocus
        />
        <Select
          label={t3(TC.folder)}
          options={folderOptions()}
          value={tempFolderId()}
          onChange={setTempFolderId}
          fullWidth
        />
      </div>
    </AlertFormHolder>
  );
}
