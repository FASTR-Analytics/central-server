import { PAGE_HEIGHT_DU, PAGE_WIDTH_DU } from "platform-lib";
import type { SlideDeckConfig } from "platform-lib";
import { PageHolder, validateBrandColor, type PageInputs, getBaseText } from "panther";
import { createResource, Show } from "solid-js";
import { buildStyleForSlide } from "~/generate_slide_deck/convert_slide_to_page_inputs";
import { getBackgroundDetail, type BackgroundDetail } from "~/generate_slide_deck/get_overlay_image";
import { getImgFromCacheOrFetch } from "~/state/images";
import { _SERVER_HOST } from "~/server_actions";

type StylePreviewProps = {
  config: SlideDeckConfig;
};

async function loadLogos(
  selected: string[],
  availableCustom: string[],
): Promise<HTMLImageElement[]> {
  const result: HTMLImageElement[] = [];
  for (const logo of selected) {
    if (availableCustom.includes(logo)) {
      const url = `${_SERVER_HOST}/${logo}`;
      const resImg = await getImgFromCacheOrFetch(url);
      if (resImg.success) {
        result.push(resImg.data);
      }
    }
  }
  return result;
}

function getCoverPageInputs(
  config: SlideDeckConfig,
  bgDetail: BackgroundDetail,
  logos: HTMLImageElement[],
): PageInputs {
  const style = buildStyleForSlide({ type: "cover", title: "" }, config, bgDetail.pattern);
  return {
    type: "cover",
    title: "Title",
    subTitle: "Subtitle",
    style,
    overlay: bgDetail.overlay,
    titleLogos: logos,
  };
}

function getSectionPageInputs(
  config: SlideDeckConfig,
  bgDetail: BackgroundDetail,
): PageInputs {
  const style = buildStyleForSlide({ type: "section", sectionTitle: "" }, config, bgDetail.pattern);
  return {
    type: "section",
    sectionTitle: "Section",
    style,
    overlay: bgDetail.overlay,
  };
}

const LOREM_TEXT = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.

Consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.`;

function getContentPageInputs(
  config: SlideDeckConfig,
  headerLogos: HTMLImageElement[],
  footerLogos: HTMLImageElement[],
): PageInputs {
  const style = buildStyleForSlide(
    { type: "content", layout: { type: "item", id: "a", data: { type: "text", markdown: "" } } },
    config,
  );
  return {
    type: "freeform",
    header: "Header",
    footer: config.globalFooterText || "Footer",
    headerLogos,
    footerLogos,
    content: {
      type: "item",
      id: "a",
      data: {
        markdown: LOREM_TEXT,
        style: { text: { base: { fontSize: getBaseText().fontSize } } },
      },
    },
    style,
  };
}

export function StylePreview(p: StylePreviewProps) {
  const colorError = () => {
    if (p.config.colorTheme.type !== "custom") return null;
    const v = validateBrandColor(p.config.colorTheme.primary);
    return v.valid ? null : v.reason;
  };

  const [bgDetail] = createResource(
    () => ({
      overlay: p.config.overlay,
      colorTheme: p.config.colorTheme,
      coverAndSectionTreatment: p.config.coverAndSectionTreatment,
    }),
    (source) =>
      getBackgroundDetail({
        ...p.config,
        overlay: source.overlay,
        colorTheme: source.colorTheme,
        coverAndSectionTreatment: source.coverAndSectionTreatment,
      }),
  );

  const availableCustom = () => p.config.logos.availableCustom;

  const [coverLogos] = createResource(
    () => ({ selected: p.config.logos.cover.selected, custom: availableCustom() }),
    (source) => loadLogos(source.selected, source.custom),
  );

  const [headerLogos] = createResource(
    () => ({ selected: p.config.logos.header.selected, custom: availableCustom() }),
    (source) => loadLogos(source.selected, source.custom),
  );

  const [footerLogos] = createResource(
    () => ({ selected: p.config.logos.footer.selected, custom: availableCustom() }),
    (source) => loadLogos(source.selected, source.custom),
  );

  const coverInputs = () =>
    getCoverPageInputs(p.config, (bgDetail() ?? {}) as BackgroundDetail, coverLogos() ?? []);
  const sectionInputs = () =>
    getSectionPageInputs(p.config, (bgDetail() ?? {}) as BackgroundDetail);
  const contentInputs = () =>
    getContentPageInputs(p.config, headerLogos() ?? [], footerLogos() ?? []);

  return (
    <div>
      <div class="ui-label">Preview</div>
      <Show when={colorError()}>
        <div class="border border-danger rounded bg-danger/10 flex items-center justify-center py-8">
          <span class="text-danger text-sm">{colorError()}</span>
        </div>
      </Show>
      <Show when={!colorError()}>
        <div class="flex gap-4" style={{ "max-width": "1600px" }}>
          <div class="flex-1">
            <div class="text-xs text-neutral mb-1">Cover</div>
            <div class="border border-base-300 rounded overflow-hidden">
              <PageHolder
                pageInputs={coverInputs()}
                pageWidthDu={PAGE_WIDTH_DU}
                pageHeightDu={PAGE_HEIGHT_DU}
              />
            </div>
          </div>
          <div class="flex-1">
            <div class="text-xs text-neutral mb-1">Section</div>
            <div class="border border-base-300 rounded overflow-hidden">
              <PageHolder
                pageInputs={sectionInputs()}
                pageWidthDu={PAGE_WIDTH_DU}
                pageHeightDu={PAGE_HEIGHT_DU}
              />
            </div>
          </div>
          <div class="flex-1">
            <div class="text-xs text-neutral mb-1">Content</div>
            <div class="border border-base-300 rounded overflow-hidden">
              <PageHolder
                pageInputs={contentInputs()}
                pageWidthDu={PAGE_WIDTH_DU}
                pageHeightDu={PAGE_HEIGHT_DU}
              />
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
