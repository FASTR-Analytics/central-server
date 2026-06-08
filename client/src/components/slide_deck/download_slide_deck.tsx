import {
  Button,
  type EditorComponentProps,
  ModalContainer,
  RadioGroup,
  StateHolderFormError,
  toPct0,
  toPct1,
} from "panther";
import { Show, createSignal } from "solid-js";
import { exportSlideDeckAsPdfVector } from "~/exports/export_slide_deck_as_pdf_vector";
import { exportSlideDeckAsPptx } from "~/exports/export_slide_deck_as_pptx";

export function DownloadSlideDeck(
  p: EditorComponentProps<
    {
      projectId: string;
      deckId: string;
    },
    undefined
  >,
) {
  const [pct, setPct] = createSignal<number>(0);
  const [err, setErr] = createSignal<string>("");
  const [exportFormat, setExportFormat] = createSignal<string>("vector");

  function progress(pct: number) {
    setPct(pct);
  }

  async function attemptExport() {
    setErr("");
    setPct(0.02);
    await new Promise((res) => setTimeout(res, 0));
    const format = exportFormat();

    const res =
      format === "vector"
        ? await exportSlideDeckAsPdfVector(p.projectId, p.deckId, progress)
        : await exportSlideDeckAsPptx(p.projectId, p.deckId, progress);

    if (res.success === false) {
      setErr(res.err);
      setPct(0);
      return;
    }
    p.close(undefined);
  }

  return (
    <ModalContainer
      title="Download slide deck"
      width="sm"
      leftButtons={
        pct() > 0
          ? undefined
          : [
              <Button onClick={attemptExport} intent="success" iconName="download">
                Download
              </Button>,
              <Button onClick={() => p.close(undefined)} intent="neutral" iconName="x">
                Done
              </Button>,
            ]
      }
    >
      <div class="ui-spy-sm">
        <div class="">PDF</div>
        <RadioGroup
          options={[{ value: "vector", label: "Native PDF (Recommended)" }]}
          value={exportFormat()}
          onChange={setExportFormat}
        />
      </div>
      <div class="ui-spy-sm">
        <div class="">PPTX</div>
        <RadioGroup
          options={[{ value: "pptx", label: "Native PPTX with raster figures" }]}
          value={exportFormat()}
          onChange={setExportFormat}
        />
      </div>
      <Show when={pct() > 0}>
        <div class="ui-spy-sm">
          <div class="bg-base-300 h-8 w-full">
            <div class="bg-primary h-full" style={{ width: toPct1(pct()) }} />
          </div>
          <div class="text-center">{toPct0(pct())}</div>
        </div>
      </Show>
      <Show when={pct() === 0 && err()}>
        <StateHolderFormError state={{ status: "error", err: err() }} />
      </Show>
    </ModalContainer>
  );
}
