import type { FigureInputs } from "panther";
import type {
  DeckStyleContext,
  IndicatorMetadata,
  PresentationObjectConfig,
} from "platform-lib";
import { getAdminAreaLevelFromMapConfig } from "./get_admin_area_level_from_config";
import { getStyleFromPresentationObject } from "./get_style_from_po";

export function stripFigureInputsForStorage(fi: FigureInputs): FigureInputs {
  const stripped: any = { ...fi, style: undefined };
  if ("mapData" in stripped && stripped.mapData) {
    stripped.mapData = { ...stripped.mapData, geoData: undefined };
  }
  return stripped;
}

export function hydrateFigureInputsForPublicRendering(
  fi: FigureInputs,
  source: {
    config: PresentationObjectConfig;
    metricId: string;
    formatAs: "percent" | "number";
  },
  geoData?: unknown,
  indicatorMetadata?: IndicatorMetadata[],
): FigureInputs {
  let hydrated = fi;

  if (
    "mapData" in hydrated &&
    hydrated.mapData &&
    !("isTransformed" in hydrated.mapData) &&
    !hydrated.mapData.geoData &&
    geoData
  ) {
    hydrated = {
      ...hydrated,
      mapData: {
        ...hydrated.mapData,
        geoData: geoData as typeof hydrated.mapData.geoData,
      },
    };
  }

  const style = getStyleFromPresentationObject(
    source.config,
    source.formatAs,
    undefined,
    indicatorMetadata,
  );
  hydrated = { ...hydrated, style };

  return hydrated;
}
