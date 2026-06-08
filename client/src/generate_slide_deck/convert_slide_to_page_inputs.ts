import type {
  ContentBlock,
  CoverSlide,
  DeckStyleContext,
  LogoVisibility,
  SectionSlide,
  Slide,
  SlideDeckConfig,
  SlideFontFamily,
} from "platform-lib";
import {
  _CF_RED,
  _SLIDE_BACKGROUND_COLOR,
  createDeckStyleContext,
  getLetterSpacing,
  getSlideFontInfo,
  getTextColorForBackground,
  resolveColorThemeToPreset,
  resolveLogoSizing,
  TEXT_SIZE_REL,
} from "platform-lib";
import type {
  APIResponseWithData,
  ContainerStyleOptions,
  CustomPageStyleOptions,
  FigureInputs,
  FontInfo,
  ImageInputs,
  LayoutNode,
  PageContentItem,
  PageInputs,
  PatternConfig,
  SplitConfig,
} from "panther";
import { getBaseText, resolvePageStyle } from "panther";
import { _SERVER_HOST } from "~/server_actions";
import { getImgFromCacheOrFetch } from "~/state/images";
import { getBackgroundDetail } from "./get_overlay_image";

const MARKDOWN_TEXT_SIZE_SCALE = 1.6;

function getFont(
  fontFamily: SlideFontFamily,
  bold?: boolean,
  italic?: boolean,
  defaultBold = false,
): FontInfo {
  return getSlideFontInfo(fontFamily, bold ?? defaultBold, italic ?? false);
}

function getSlideSplit(
  slide: Slide,
  primaryColor: string,
): SplitConfig | undefined {
  if (slide.type !== "content" || !slide.split) return undefined;
  const { placement, sizeAsPct, fill } = slide.split;
  const size = sizeAsPct / 100;
  if (fill.type === "plain") {
    return { placement, sizeAsPct: size, background: primaryColor };
  }
  if (fill.type === "pattern") {
    return {
      placement,
      sizeAsPct: size,
      background: { type: fill.patternType, baseColor: primaryColor },
    };
  }
  return { placement, sizeAsPct: size, background: primaryColor };
}

export function buildStyleForSlide(
  slide: Slide,
  config: SlideDeckConfig,
  pattern?: Omit<PatternConfig, "baseColor">,
): CustomPageStyleOptions {
  const preset = resolveColorThemeToPreset(config.colorTheme);
  const { style: presetStyle } = resolvePageStyle(
    config.layout,
    config.coverAndSectionTreatment,
    config.freeformTreatment,
    preset,
    pattern ? { pattern } : undefined,
  );

  const coverFontSizes =
    slide.type === "cover"
      ? (slide as CoverSlide)
      : ({} as Partial<CoverSlide>);

  const sectionFontSizes =
    slide.type === "section"
      ? (slide as SectionSlide)
      : ({} as Partial<SectionSlide>);

  const footerText =
    slide.type === "content"
      ? (config.globalFooterText ?? slide.footer)
      : undefined;
  const hasFooter = !!footerText?.trim();
  const fontFamily = config.fontFamily ?? "International Inter";

  return {
    text: {
      coverTitle: {
        font: getFont(fontFamily, coverFontSizes.titleBold, coverFontSizes.titleItalic, true),
        color: presetStyle.text!.coverTitle!.color,
        relFontSize: (coverFontSizes.titleTextRelFontSize ?? 10) / 2,
        letterSpacing: getLetterSpacing(fontFamily),
        lineHeight: 1,
      },
      coverSubTitle: {
        font: getFont(fontFamily, coverFontSizes.subTitleBold, coverFontSizes.subTitleItalic, false),
        color: presetStyle.text!.coverSubTitle!.color,
        relFontSize: (coverFontSizes.subTitleTextRelFontSize ?? 6) / 2,
        letterSpacing: getLetterSpacing(fontFamily),
        lineHeight: 1.1,
      },
      coverAuthor: {
        font: getFont(fontFamily, coverFontSizes.presenterBold, coverFontSizes.presenterItalic, false),
        color: presetStyle.text!.coverAuthor!.color,
        relFontSize: (coverFontSizes.presenterTextRelFontSize ?? 4) / 2,
        lineHeight: 1.2,
      },
      coverDate: {
        font: getFont(fontFamily, coverFontSizes.dateBold, coverFontSizes.dateItalic, false),
        color: presetStyle.text!.coverDate!.color,
        relFontSize: (coverFontSizes.dateTextRelFontSize ?? 3) / 2,
        lineHeight: 1.1,
      },
      sectionTitle: {
        font: getFont(fontFamily, sectionFontSizes.sectionTitleBold, sectionFontSizes.sectionTitleItalic, true),
        color: presetStyle.text!.sectionTitle!.color,
        relFontSize: (sectionFontSizes.sectionTextRelFontSize ?? 8) / 2,
        letterSpacing: getLetterSpacing(fontFamily),
        lineHeight: 1.05,
      },
      sectionSubTitle: {
        font: getFont(fontFamily, sectionFontSizes.sectionSubTitleBold, sectionFontSizes.sectionSubTitleItalic, false),
        color: presetStyle.text!.sectionSubTitle!.color,
        relFontSize: (sectionFontSizes.smallerSectionTextRelFontSize ?? 5) / 2,
        letterSpacing: getLetterSpacing(fontFamily),
        lineHeight: 1.1,
      },
      header: {
        font: getFont(fontFamily, undefined, undefined, true),
        color: presetStyle.text!.header!.color,
        relFontSize: 3.5,
        letterSpacing: getLetterSpacing(fontFamily),
        lineHeight: 1,
      },
      subHeader: {
        font: getFont(fontFamily, undefined, undefined, false),
        color: presetStyle.text!.subHeader!.color,
        relFontSize: 2,
        letterSpacing: getLetterSpacing(fontFamily),
        lineHeight: 1,
      },
      date: {
        font: getFont(fontFamily, undefined, undefined, false),
        color: presetStyle.text!.date!.color,
        relFontSize: 1,
        lineHeight: 1,
      },
      footer: {
        font: getFont(fontFamily, undefined, undefined, false),
        color: presetStyle.text!.footer!.color,
        relFontSize: 1,
      },
      pageNumber: {
        font: getFont(fontFamily, undefined, undefined, false),
        color: hasFooter
          ? presetStyle.text!.footer!.color
          : presetStyle.text!.header!.color,
        relFontSize: 0.8,
      },
    },
    cover: {
      background: presetStyle.cover!.background,
      padding: presetStyle.cover!.padding,
      split: presetStyle.cover!.split,
      logosSizing: {
        ...presetStyle.cover!.logosSizing,
        ...resolveLogoSizing(config.logos.cover.sizing),
        maxHeight: Infinity,
        maxWidth: Infinity,
      },
      logosPlacement: presetStyle.cover!.logosPlacement,
      titleBottomPadding: presetStyle.cover!.titleBottomPadding,
      subTitleBottomPadding: presetStyle.cover!.subTitleBottomPadding,
      authorBottomPadding: presetStyle.cover!.authorBottomPadding,
      alignH: presetStyle.cover!.alignH,
      alignV: presetStyle.cover!.alignV,
    },
    section: {
      background: presetStyle.section!.background,
      padding: presetStyle.section!.padding,
      split: presetStyle.section!.split,
      sectionTitleBottomPadding: presetStyle.section!.sectionTitleBottomPadding,
      alignH: presetStyle.section!.alignH,
      alignV: presetStyle.section!.alignV,
    },
    freeform: {
      split: getSlideSplit(slide, preset.primary),
      header: {
        background: presetStyle.freeform!.header!.background,
        padding: presetStyle.freeform!.header!.padding,
        logosSizing: {
          ...presetStyle.freeform!.header!.logosSizing,
          ...resolveLogoSizing(config.logos.header.sizing),
          maxHeight: Infinity,
          maxWidth: Infinity,
        },
        headerBottomPadding: presetStyle.freeform!.header!.headerBottomPadding,
        subHeaderBottomPadding: presetStyle.freeform!.header!.subHeaderBottomPadding,
        bottomBorderStrokeWidth: presetStyle.freeform!.header!.bottomBorderStrokeWidth,
        bottomBorderColor: presetStyle.freeform!.header!.bottomBorderColor,
        alignH: presetStyle.freeform!.header!.alignH,
      },
      content: {
        background: presetStyle.freeform!.content!.background,
        padding: presetStyle.freeform!.content!.padding,
        gapX: presetStyle.freeform!.content!.gapX,
        gapY: presetStyle.freeform!.content!.gapY,
      },
      footer: {
        background: presetStyle.freeform!.footer!.background,
        padding: presetStyle.freeform!.footer!.padding,
        logosSizing: {
          ...presetStyle.freeform!.footer!.logosSizing,
          ...resolveLogoSizing(config.logos.footer.sizing),
          maxHeight: Infinity,
          maxWidth: Infinity,
        },
        alignH: presetStyle.freeform!.footer!.alignH,
      },
    },
  };
}

function shouldShowLogos(slideOverride: LogoVisibility | undefined, showByDefault: boolean): boolean {
  if (slideOverride === "show") return true;
  if (slideOverride === "hide") return false;
  return showByDefault;
}

async function loadLogos(selected: string[], availableCustom: string[]): Promise<HTMLImageElement[]> {
  const result: HTMLImageElement[] = [];
  for (const logo of selected) {
    if (availableCustom.includes(logo)) {
      const resImg = await getImgFromCacheOrFetch(`${_SERVER_HOST}/${logo}`);
      if (resImg.success) result.push(resImg.data);
    }
  }
  return result;
}

export async function convertSlideToPageInputs(
  projectId: string,
  slide: Slide,
  slideIndex: number | undefined,
  config: SlideDeckConfig,
): Promise<APIResponseWithData<PageInputs>> {
  const backgroundDetail = slide.type !== "content" ? await getBackgroundDetail(config) : {};
  const style = buildStyleForSlide(slide, config, backgroundDetail.pattern);
  const watermark = config.useWatermark ? config.watermarkText : undefined;

  if (slide.type === "cover") {
    const showCoverLogos = shouldShowLogos(slide.showLogos, config.logos.cover.showByDefault);
    const titleLogos = showCoverLogos
      ? await loadLogos(config.logos.cover.selected, config.logos.availableCustom)
      : [];
    return {
      success: true,
      data: {
        type: "cover",
        title: slide.title,
        subTitle: slide.subtitle,
        author: slide.presenter,
        date: slide.date,
        titleLogos,
        style,
        watermark,
        overlay: backgroundDetail.overlay,
      },
    };
  }

  if (slide.type === "section") {
    return {
      success: true,
      data: {
        type: "section",
        sectionTitle: slide.sectionTitle,
        sectionSubTitle: slide.sectionSubtitle,
        style,
        watermark,
        overlay: backgroundDetail.overlay,
      },
    };
  }

  const preset = resolveColorThemeToPreset(config.colorTheme);
  const deckStyle = createDeckStyleContext(config);
  const convertedLayout = await convertLayoutNode(slide.layout, preset.primary, deckStyle);
  const footerText = config.globalFooterText ?? slide.footer;

  const showHeaderLogos = shouldShowLogos(slide.showHeaderLogos, config.logos.header.showByDefault);
  const showFooterLogos = shouldShowLogos(slide.showFooterLogos, config.logos.footer.showByDefault);

  const headerLogos = showHeaderLogos
    ? await loadLogos(config.logos.header.selected, config.logos.availableCustom)
    : [];
  const footerLogos = showFooterLogos
    ? await loadLogos(config.logos.footer.selected, config.logos.availableCustom)
    : [];

  let splitImage: HTMLImageElement | undefined;
  if (slide.split?.fill.type === "image" && slide.split.fill.imgFile) {
    const res = await getImgFromCacheOrFetch(`${_SERVER_HOST}/${slide.split.fill.imgFile}`);
    if (res.success) splitImage = res.data;
  }

  return {
    success: true,
    data: {
      type: "freeform",
      header: slide.header,
      subHeader: slide.subHeader,
      date: slide.date,
      footer: footerText,
      headerLogos,
      footerLogos,
      content: convertedLayout,
      style,
      watermark,
      overlay: backgroundDetail.overlay,
      splitImage,
    },
  };
}

type ResolvedTextBackground = {
  containerStyle: ContainerStyleOptions;
  textColor: string;
};

function resolveTextBackground(bg: string | undefined, primaryColor: string): ResolvedTextBackground | undefined {
  const TEXT_BACKGROUND_PADDING = [15, 20];
  if (!bg || bg === "none") return undefined;
  if (bg === "grey") {
    return {
      containerStyle: { backgroundColor: { key: "base200" }, padding: TEXT_BACKGROUND_PADDING },
      textColor: "#1E1E1E",
    };
  }
  if (bg === "primary") {
    return {
      containerStyle: { backgroundColor: primaryColor, padding: TEXT_BACKGROUND_PADDING },
      textColor: getTextColorForBackground(primaryColor),
    };
  }
  if (bg === "success") {
    return {
      containerStyle: { backgroundColor: _SLIDE_BACKGROUND_COLOR, padding: TEXT_BACKGROUND_PADDING },
      textColor: getTextColorForBackground(_SLIDE_BACKGROUND_COLOR),
    };
  }
  if (bg === "danger") {
    return {
      containerStyle: { backgroundColor: _CF_RED, padding: TEXT_BACKGROUND_PADDING },
      textColor: getTextColorForBackground(_CF_RED),
    };
  }
  return undefined;
}

async function convertLayoutNode(
  node: LayoutNode<ContentBlock>,
  primaryColor: string,
  deckStyle: DeckStyleContext,
): Promise<LayoutNode<PageContentItem>> {
  if (node.type === "item") {
    if (!node.data) {
      return { type: "item", id: node.id, span: node.span, data: { spacer: true } };
    }
    const resolved =
      node.data.type === "text"
        ? resolveTextBackground(node.data.style?.textBackground, primaryColor)
        : undefined;
    return {
      type: "item",
      id: node.id,
      span: node.span,
      data: await convertBlockToPageContentItem(node.data, resolved?.textColor, deckStyle),
      style: resolved?.containerStyle,
    };
  }

  return {
    type: node.type,
    id: node.id,
    span: node.span,
    children: Array.isArray(node.children)
      ? await Promise.all(node.children.map((c) => convertLayoutNode(c, primaryColor, deckStyle)))
      : [],
  };
}

async function convertBlockToPageContentItem(
  block: ContentBlock,
  textColor: string | undefined,
  deckStyle: DeckStyleContext,
): Promise<PageContentItem> {
  if (block.type === "text") {
    const baseFontSize = getBaseText().fontSize * MARKDOWN_TEXT_SIZE_SCALE;
    const fontFamily = deckStyle.fontFamily;
    return {
      markdown: block.markdown,
      style: {
        text: {
          base: {
            font: getSlideFontInfo(fontFamily, false, false),
            fontSize: baseFontSize,
            ...(textColor ? { color: textColor } : {}),
          },
        },
      },
    };
  }

  if (block.type === "image") {
    if (!block.imgFile) return { spacer: true };
    const resImg = await getImgFromCacheOrFetch(`${_SERVER_HOST}/${block.imgFile}`);
    if (!resImg.success) return { spacer: true };
    const imageItem: ImageInputs = {
      image: resImg.data,
      fit: block.style?.imgFit ?? "contain",
      align: block.style?.imgAlign,
    };
    return imageItem;
  }

  const fi: FigureInputs | undefined = block.figureInputs;
  if (
    !fi ||
    !(
      "tableData" in fi ||
      "chartData" in fi ||
      "chartOHData" in fi ||
      "timeseriesData" in fi ||
      "simpleVizData" in fi ||
      "mapData" in fi
    )
  ) {
    return { spacer: true };
  }

  return fi as PageContentItem;
}
