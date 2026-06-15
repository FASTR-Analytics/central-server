import type { FigureInputs, GeoJSONFeatureCollection } from "panther";
import type {
  FigureBundle,
  ItemsHolderPresentationObject,
  ResultsValueForVisualization,
} from "platform-lib";
import { getFigureInputsFromPresentationObject } from "./get_figure_inputs_from_po";

// Renders a stored FigureBundle into FigureInputs. Mirrors the platform's
// buildFigureInputs, but reuses central's getFigureInputsFromPresentationObject
// (whose helper signatures differ from the platform's, so the platform file
// can't be ported verbatim). The bundle is self-contained, so this is the only
// thing the slide renderer needs to turn a saved figure block into a page item.
export function buildFigureInputsFromBundle(bundle: FigureBundle): FigureInputs {
  const resultsValue: ResultsValueForVisualization = {
    formatAs: bundle.resultsValue.formatAs,
    valueProps: bundle.resultsValue.valueProps,
    valueLabelReplacements: bundle.resultsValue.valueLabelReplacements,
  };

  // getFigureInputsFromPresentationObject only reads status/items/
  // indicatorMetadata/dateRange off the holder; the remaining
  // ItemsHolderPresentationObject fields (projectId/resultsObjectId/fetchConfig)
  // aren't needed at render time, so we reconstruct the minimal shape.
  const ih = {
    status: "ok",
    items: bundle.items,
    indicatorMetadata: bundle.indicatorMetadata,
    dateRange: bundle.dateRange,
    moduleLastRun: bundle.provenance.moduleLastRun,
    datasetsVersion: bundle.provenance.datasetsVersion,
  } as unknown as ItemsHolderPresentationObject;

  // Central has no geojson sync cache, so only an embedded geo payload can be
  // rendered. Slide maps weren't supported before the migration either.
  const geoJson =
    bundle.geo?.kind === "data"
      ? (bundle.geo.data as GeoJSONFeatureCollection)
      : undefined;

  const res = getFigureInputsFromPresentationObject(
    resultsValue,
    ih,
    bundle.config,
    geoJson,
  );
  if (res.status !== "ready") {
    throw new Error(res.status === "error" ? res.err : "Figure inputs not ready");
  }
  return res.data;
}
