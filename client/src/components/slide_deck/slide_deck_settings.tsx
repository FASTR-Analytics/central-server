import type { SlideDeckConfig } from "platform-lib";
import { validateBrandColor } from "panther";
import {
  type APIResponseWithData,
  Button,
  Checkbox,
  type EditorComponentProps,
  FrameTop,
  HeadingBar,
  SettingsSection,
  TextArea,
  createButtonAction,
  createDeleteAction,
} from "panther";
import { createSignal, Show } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { ColorThemePicker } from "./style_editor/ColorThemePicker.tsx";
import { FontPicker } from "./style_editor/FontPicker.tsx";
import { LayoutPicker } from "./style_editor/LayoutPicker.tsx";
import { OverlayPicker } from "./style_editor/OverlayPicker.tsx";
import { CoverTreatmentPicker, FreeformTreatmentPicker } from "./style_editor/TreatmentPicker.tsx";
import { StylePreview } from "./style_editor/StylePreview.tsx";

export type SlideDeckSettingsProps = {
  projectId: string;
  config: SlideDeckConfig;
  heading: string;
  nameLabel: string;
  showPageNumbersSuffix?: string;
  saveConfig: (
    config: SlideDeckConfig,
  ) => Promise<APIResponseWithData<{ lastUpdated: string }>>;
  onSaved: (lastUpdated: string) => Promise<void>;
  deleteAction?: {
    confirmText: string;
    itemLabel: string;
    deleteButtonLabel: string;
    onDelete: () => Promise<APIResponseWithData<never> | { success: true }>;
  };
};

type Props = EditorComponentProps<SlideDeckSettingsProps, "AFTER_DELETE">;

export function SlideDeckSettings(p: Props) {
  const [tempConfig, setTempConfig] = createStore<SlideDeckConfig>(
    structuredClone(p.config),
  );
  const [editingName, setEditingName] = createSignal(false);

  const save = createButtonAction(
    async () => {
      const newConfig = unwrap(tempConfig);
      if (newConfig.colorTheme.type === "custom") {
        const v = validateBrandColor(newConfig.colorTheme.primary);
        if (!v.valid) {
          return { success: false as const, err: v.reason };
        }
      }
      const res = await p.saveConfig(newConfig);
      if (res.success === false) return res;
      await p.onSaved(res.data.lastUpdated);
      return res;
    },
    () => p.close(undefined),
  );

  async function attemptDelete() {
    if (!p.deleteAction) return;
    const da = p.deleteAction;
    const deleteAction = createDeleteAction(
      {
        text: da.confirmText,
        itemList: [da.itemLabel],
      },
      da.onDelete,
      () => p.close("AFTER_DELETE"),
    );
    await deleteAction.click();
  }

  return (
    <FrameTop
      panelChildren={
        <HeadingBar
          heading={
            <div class="flex items-center gap-2">
              <span>{p.heading}:</span>
              <Show when={!editingName()}>
                <span class="font-normal">{tempConfig.label}</span>
                <Button
                  iconName="pencil"
                  intent="neutral"
                  size="sm"
                  outline
                  onClick={() => setEditingName(true)}
                />
              </Show>
              <Show when={editingName()}>
                <input
                  type="text"
                  class="border-base-300 rounded border px-2 py-1 text-base font-normal"
                  value={tempConfig.label}
                  onInput={(e) => setTempConfig("label", e.currentTarget.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setEditingName(false);
                  }}
                  autofocus
                />
              </Show>
            </div>
          }
        >
          <div class="ui-gap-sm flex">
            <Button onClick={save.click} state={save.state()} intent="success" iconName="save">
              Save
            </Button>
            <Button onClick={() => p.close(undefined)} intent="neutral" iconName="x">
              Cancel
            </Button>
          </div>
        </HeadingBar>
      }
    >
      <div class="ui-pad ui-spy">
        <SettingsSection header="Style">
          <div class="ui-spy">
            <StylePreview config={tempConfig} />
            <ColorThemePicker
              value={tempConfig.colorTheme}
              onChange={(v) => setTempConfig("colorTheme", v)}
            />
            <FontPicker
              value={tempConfig.fontFamily}
              onChange={(v) => setTempConfig("fontFamily", v)}
            />
            <LayoutPicker
              value={tempConfig.layout}
              onChange={(v) => setTempConfig("layout", v)}
            />
            <CoverTreatmentPicker
              value={tempConfig.coverAndSectionTreatment}
              onChange={(v) => setTempConfig("coverAndSectionTreatment", v)}
            />
            <FreeformTreatmentPicker
              value={tempConfig.freeformTreatment}
              onChange={(v) => setTempConfig("freeformTreatment", v)}
            />
            <OverlayPicker
              value={tempConfig.overlay}
              onChange={(v) => setTempConfig("overlay", v)}
            />
          </div>
        </SettingsSection>
        <SettingsSection header="Footer & page numbers">
          <div class="ui-spy-sm">
            <Checkbox
              label="Set global footer text for all content slides"
              checked={tempConfig.globalFooterText !== undefined}
              onChange={(v) => {
                if (v) {
                  setTempConfig("globalFooterText", "");
                } else {
                  setTempConfig("globalFooterText", undefined);
                }
              }}
            />
            <Show when={tempConfig.globalFooterText !== undefined}>
              <TextArea
                label="Footer text"
                value={tempConfig.globalFooterText!}
                onChange={(v: string) => setTempConfig("globalFooterText", v)}
                fullWidth
                height="40px"
              />
            </Show>
            <Checkbox
              label={`Show page numbers${p.showPageNumbersSuffix ? ` ${p.showPageNumbersSuffix}` : ""}`}
              checked={tempConfig.showPageNumbers}
              onChange={(v) => setTempConfig("showPageNumbers", v)}
            />
          </div>
        </SettingsSection>
        <Show when={p.deleteAction}>
          <div>
            <Button onClick={attemptDelete} intent="danger" outline iconName="trash">
              {p.deleteAction!.deleteButtonLabel}
            </Button>
          </div>
        </Show>
      </div>
    </FrameTop>
  );
}
