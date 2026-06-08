import type { SlideDeckConfig } from "platform-lib";
import { resolveColorThemeToPreset } from "platform-lib";
import {
  Color,
  getCoverTreatment,
  getPatternDefaults,
  type ColorPreset,
  type PatternConfig,
  type PatternType,
} from "panther";
import { getImgFromCacheOrFetch } from "~/state/images";

function getCoverBackgroundColor(config: SlideDeckConfig): string {
  const colorPreset = resolveColorThemeToPreset(config.colorTheme);
  const coverTreatment = getCoverTreatment(config.coverAndSectionTreatment);
  const background = coverTreatment.background;
  return colorPreset[background as keyof ColorPreset] as string;
}

export type BackgroundDetail = {
  overlay?: HTMLImageElement;
  pattern?: Omit<PatternConfig, "baseColor">;
};

export async function getBackgroundDetail(
  config: SlideDeckConfig,
): Promise<BackgroundDetail> {
  if (!config.overlay || config.overlay === "none" || config.overlay === "pattern-none") {
    return {};
  }

  if (config.overlay.startsWith("pattern-")) {
    const patternType = config.overlay.replace("pattern-", "") as PatternType;
    const pattern = {
      type: patternType,
      ...getPatternDefaults(patternType),
    };
    return { pattern };
  }

  const bgColor = getCoverBackgroundColor(config);
  const lightOrDark = new Color(bgColor).isLight() ? "light" : "dark";
  const filePath = `/images/${config.overlay}_for_${lightOrDark}_themes.png`;
  const resImg = await getImgFromCacheOrFetch(filePath);
  if (resImg.success === false) {
    return {};
  }
  return { overlay: resImg.data };
}
