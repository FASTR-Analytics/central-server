import { createSignal, Show } from "solid-js";
import { t3, TC } from "platform-lib";
import { serverActions } from "~/server_actions";
import {
  Button,
  Checkbox,
  Csv,
  FrameTop,
  HeaderBarCanGoBack,
  StateHolderFormError,
  createFormAction,
  type AlertComponentProps,
} from "panther";

type Props = AlertComponentProps<{}, undefined>;

export function BatchUploadUsersForm(p: Props) {
  const [selectedFileName, setSelectedFileName] = createSignal<string>("");
  const [selectedFileText, setSelectedFileText] = createSignal<string>("");
  const [replaceAllExisting, setReplaceAllExisting] =
    createSignal<boolean>(false);

  let fileInputRef: HTMLInputElement | undefined;

  async function handleFileSelected(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setSelectedFileText(await file.text());
    setSelectedFileName(file.name);
    input.value = "";
  }

  const handleBatchUpload = createFormAction(
    async () => {
      const text = selectedFileText();

      if (!text) {
        return { success: false, err: t3({ en: "You must select a CSV file", fr: "Vous devez sélectionner un fichier CSV" }) };
      }

      let rows: Record<string, string>[];
      try {
        rows = Csv.fromString(text).toObjects();
      } catch (error) {
        return {
          success: false,
          err: `Failed to read CSV file: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      const users = rows.map((row) => ({
        email: row.email || "",
        is_admin: row.is_admin || "false",
      }));

      return serverActions.batchUploadUsers({
        users,
        replaceAllExisting: replaceAllExisting(),
      });
    },
    async () => {
      p.close(undefined);
    },
  );

  return (
    <FrameTop
      panelChildren={
        <HeaderBarCanGoBack
          heading={t3({ en: "Batch import users", fr: "Importation groupée d'utilisateurs" })}
          back={() => p.close(undefined)}
        />
      }
    >
      <div class="ui-pad ui-spy">
        <div class="text-sm">
          {t3({ en: "Upload a CSV file with the following headers:", fr: "Téléversez un fichier CSV avec les en-têtes suivants :" })}
          <span class="font-700 ml-3 font-mono">email, is_admin</span>
        </div>

        <div class="text-sm text-gray-600">
          {t3({ en: "Example:", fr: "Exemple :" })} <span class="font-mono">user@example.com,false</span>
        </div>

        <div class="">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            class="hidden"
            onChange={handleFileSelected}
          />
          <Button onClick={() => fileInputRef?.click()} iconName="upload">
            {t3({ en: "Select CSV file", fr: "Sélectionner un fichier CSV" })}
          </Button>
        </div>

        <Show when={selectedFileName()}>
          <div class="text-sm">
            {t3({ en: "Selected file", fr: "Fichier sélectionné" })}:{" "}
            <span class="font-700 font-mono">{selectedFileName()}</span>
          </div>
        </Show>

        <div class="">
          <Checkbox
            label={t3({ en: "Replace all existing users (DANGEROUS)", fr: "Remplacer tous les utilisateurs existants (DANGEREUX)" })}
            checked={replaceAllExisting()}
            onChange={setReplaceAllExisting}
          />
        </div>

        <StateHolderFormError state={handleBatchUpload.state()} />

        <div class="ui-gap-sm flex">
          <Button
            onClick={handleBatchUpload.click}
            intent="primary"
            state={handleBatchUpload.state()}
            disabled={!selectedFileName()}
            iconName="upload"
          >
            {t3({ en: "Process CSV", fr: "Traiter le CSV" })}
          </Button>
          <Button onClick={() => p.close(undefined)} intent="neutral">
            {t3(TC.cancel)}
          </Button>
        </div>
      </div>
    </FrameTop>
  );
}
