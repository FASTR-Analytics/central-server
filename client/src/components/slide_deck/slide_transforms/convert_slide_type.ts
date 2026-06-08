import type { Slide } from "platform-lib";
import { generateUniqueBlockId } from "~/components/slide_deck/_id_generation";

export function convertSlideType(slide: Slide, targetType: "cover" | "section" | "content"): Slide {
  if (slide.type === targetType) return slide;

  if (targetType === "cover") {
    const title = slide.type === "section"
      ? slide.sectionTitle
      : slide.type === "content"
      ? slide.header || ""
      : "";
    return { type: "cover", title: title, subtitle: undefined, presenter: undefined, date: undefined };
  }

  if (targetType === "section") {
    const title = slide.type === "cover"
      ? slide.title || ""
      : slide.type === "content"
      ? slide.header || ""
      : "";
    return { type: "section", sectionTitle: title, sectionSubtitle: undefined };
  }

  const header = slide.type === "cover"
    ? slide.title || ""
    : slide.type === "section"
    ? slide.sectionTitle
    : "";

  return {
    type: "content",
    header: header || undefined,
    layout: { type: "item", id: generateUniqueBlockId(), data: { type: "text", markdown: "" } },
  };
}
