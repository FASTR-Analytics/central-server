import type { Slide, CoverSlide, SectionSlide, ContentSlide } from "platform-lib";
import { Match, type Setter, Switch } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { SlideEditorPanelCover } from "./editor_panel_cover";
import { SlideEditorPanelSection } from "./editor_panel_section";
import { SlideEditorPanelContent } from "./editor_panel_content";

type Props = {
  projectId: string;
  tempSlide: Slide;
  setTempSlide: SetStoreFunction<Slide>;
  selectedBlockId: string | undefined;
  setSelectedBlockId: Setter<string | undefined>;
  contentTab: "slide" | "block";
  setContentTab: Setter<"slide" | "block">;
  onShowLayoutMenu: (x: number, y: number) => void;
  onSelectVisualization: () => void;
  showCoverLogosByDefault: boolean;
  showHeaderLogosByDefault: boolean;
  showFooterLogosByDefault: boolean;
  hasGlobalFooterText: boolean;
};

export function SlideEditorPanel(p: Props) {
  return (
    <div class="flex h-full flex-col overflow-auto border-r border-base-content">
      <Switch>
        <Match when={p.tempSlide.type === "cover"}>
          <SlideEditorPanelCover
            tempSlide={p.tempSlide as CoverSlide}
            setTempSlide={p.setTempSlide}
            showLogosByDefault={p.showCoverLogosByDefault}
          />
        </Match>
        <Match when={p.tempSlide.type === "section"}>
          <SlideEditorPanelSection
            tempSlide={p.tempSlide as SectionSlide}
            setTempSlide={p.setTempSlide}
          />
        </Match>
        <Match when={p.tempSlide.type === "content"}>
          <SlideEditorPanelContent
            projectId={p.projectId}
            tempSlide={p.tempSlide as ContentSlide}
            setTempSlide={p.setTempSlide}
            selectedBlockId={p.selectedBlockId}
            setSelectedBlockId={p.setSelectedBlockId}
            contentTab={p.contentTab}
            setContentTab={p.setContentTab}
            onShowLayoutMenu={p.onShowLayoutMenu}
            onSelectVisualization={p.onSelectVisualization}
            showHeaderLogosByDefault={p.showHeaderLogosByDefault}
            showFooterLogosByDefault={p.showFooterLogosByDefault}
            hasGlobalFooterText={p.hasGlobalFooterText}
          />
        </Match>
      </Switch>
    </div>
  );
}
