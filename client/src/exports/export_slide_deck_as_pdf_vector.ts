import {
  APIResponseNoData,
  RectCoordsDims,
  PageRenderer,
  createPdfRenderContextWithFontsBrowser,
  type FontInfo,
} from "panther";
import { type Slide, getAllSlideFontVariants, PAGE_HEIGHT_DU, PAGE_WIDTH_DU } from "platform-lib";
import { serverActions } from "~/server_actions";
import { convertSlideToPageInputs } from "../generate_slide_deck/convert_slide_to_page_inputs";
import fontMap from "~/font-map.json";

export async function exportSlideDeckAsPdfVector(
  projectId: string,
  deckId: string,
  progress: (pct: number) => void,
): Promise<APIResponseNoData> {
  let currentSlideNumber = 0;
  try {
    await new Promise((res) => setTimeout(res, 0));
    progress(0.05);

    const resDeckDetail = await serverActions.getSlideDeckDetail({ projectId, deckId });

    await new Promise((res) => setTimeout(res, 0));
    progress(0.1);
    if (resDeckDetail.success === false) return resDeckDetail;

    const pdfW = PAGE_WIDTH_DU;
    const pdfH = PAGE_HEIGHT_DU;
    const pdfOrientation = "landscape";

    const fontFamily = resDeckDetail.data.config.fontFamily ?? "International Inter";
    const fonts: FontInfo[] = getAllSlideFontVariants(fontFamily);

    progress(0.15);

    const { pdf, rc } = await createPdfRenderContextWithFontsBrowser(
      pdfW,
      pdfH,
      fonts,
      { basePath: "/fonts", fontMap: fontMap.ttf },
    );

    progress(0.2);

    for (let i = 0; i < resDeckDetail.data.slideIds.length; i++) {
      currentSlideNumber = i + 1;
      const slideId = resDeckDetail.data.slideIds[i];
      await new Promise((res) => setTimeout(res, 0));
      progress(0.2 + (0.8 * i) / resDeckDetail.data.slideIds.length);
      if (i > 0) {
        pdf.addPage([pdfW, pdfH], pdfOrientation);
      }

      const res = await serverActions.getSlide({ projectId, slideId });
      if (res.success === false) return res;
      const slide: Slide = res.data.slide;

      const resPageInputs = await convertSlideToPageInputs(
        projectId,
        slide,
        i,
        resDeckDetail.data.config,
      );

      if (resPageInputs.success === false) return resPageInputs;

      const rcd = new RectCoordsDims([0, 0, pdfW, pdfH]);
      await PageRenderer.measureAndRender(rc, rcd, resPageInputs.data);
    }

    await new Promise((res) => setTimeout(res, 0));
    progress(1);
    pdf.save(`${resDeckDetail.data.label}.pdf`);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      err: `Error creating slide ${currentSlideNumber}: ` + (e instanceof Error ? e.message : ""),
    };
  }
}
