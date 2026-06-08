import type { SectionSlide } from "platform-lib";
import { TextArea } from "panther";
import type { SetStoreFunction } from "solid-js/store";
import { TextStylePopover } from "./TextStylePopover.tsx";

type Props = {
  tempSlide: SectionSlide;
  setTempSlide: SetStoreFunction<any>;
};

export function SlideEditorPanelSection(p: Props) {
  return (
    <div class="ui-pad ui-spy">
      <div class="ui-spy-sm">
        <TextArea
          label="Section Title"
          value={p.tempSlide.sectionTitle}
          onChange={(v: string) => p.setTempSlide("sectionTitle", v)}
          fullWidth
          height="80px"
        />
        <div class="flex w-full justify-end">
          <TextStylePopover
            size={p.tempSlide.sectionTextRelFontSize ?? 8}
            onSizeChange={(v) => p.setTempSlide("sectionTextRelFontSize", v)}
            bold={p.tempSlide.sectionTitleBold ?? true}
            onBoldChange={(v) => p.setTempSlide("sectionTitleBold", v)}
            italic={p.tempSlide.sectionTitleItalic ?? false}
            onItalicChange={(v) => p.setTempSlide("sectionTitleItalic", v)}
            sizeMin={4}
            sizeMax={16}
            defaults={{ size: 8, bold: true, italic: false }}
            onReset={() => {
              p.setTempSlide("sectionTextRelFontSize", undefined);
              p.setTempSlide("sectionTitleBold", undefined);
              p.setTempSlide("sectionTitleItalic", undefined);
            }}
          />
        </div>
      </div>
      <div class="ui-spy-sm">
        <TextArea
          label="Section Subtitle"
          value={p.tempSlide.sectionSubtitle ?? ""}
          onChange={(v: string) => p.setTempSlide("sectionSubtitle", v || undefined)}
          fullWidth
          height="60px"
        />
        <div class="flex w-full justify-end">
          <TextStylePopover
            size={p.tempSlide.smallerSectionTextRelFontSize ?? 5}
            onSizeChange={(v) => p.setTempSlide("smallerSectionTextRelFontSize", v)}
            bold={p.tempSlide.sectionSubTitleBold ?? false}
            onBoldChange={(v) => p.setTempSlide("sectionSubTitleBold", v)}
            italic={p.tempSlide.sectionSubTitleItalic ?? false}
            onItalicChange={(v) => p.setTempSlide("sectionSubTitleItalic", v)}
            sizeMin={2}
            sizeMax={10}
            defaults={{ size: 5, bold: false, italic: false }}
            onReset={() => {
              p.setTempSlide("smallerSectionTextRelFontSize", undefined);
              p.setTempSlide("sectionSubTitleBold", undefined);
              p.setTempSlide("sectionSubTitleItalic", undefined);
            }}
          />
        </div>
      </div>
    </div>
  );
}
