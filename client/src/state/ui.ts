import { createSignal } from "solid-js";
import type {
  SlideDeckGroupingMode,
  VisualizationGroupingMode,
} from "platform-lib";

// Visualization grouping/filtering
const storedGroupingMode = localStorage.getItem(
  "vizGroupingMode",
) as VisualizationGroupingMode | null;

export const [vizGroupingMode, setVizGroupingModeInternal] =
  createSignal<VisualizationGroupingMode>(storedGroupingMode ?? "folders");

export function setVizGroupingMode(mode: VisualizationGroupingMode) {
  localStorage.setItem("vizGroupingMode", mode);
  setVizGroupingModeInternal(mode);
}

const storedSelectedGroup = localStorage.getItem("vizSelectedGroup");

export const [vizSelectedGroup, setVizSelectedGroupInternal] = createSignal<
  string | null
>(storedSelectedGroup);

export function setVizSelectedGroup(group: string | null) {
  if (group === null) {
    localStorage.removeItem("vizSelectedGroup");
  } else {
    localStorage.setItem("vizSelectedGroup", group);
  }
  setVizSelectedGroupInternal(group);
}

// Slide deck grouping/filtering
const storedDeckGroupingMode = localStorage.getItem(
  "deckGroupingMode",
) as SlideDeckGroupingMode | null;

export const [deckGroupingMode, setDeckGroupingModeInternal] =
  createSignal<SlideDeckGroupingMode>(storedDeckGroupingMode ?? "folders");

export function setDeckGroupingMode(mode: SlideDeckGroupingMode) {
  localStorage.setItem("deckGroupingMode", mode);
  setDeckGroupingModeInternal(mode);
}

const storedDeckSelectedGroup = localStorage.getItem("deckSelectedGroup");

export const [deckSelectedGroup, setDeckSelectedGroupInternal] = createSignal<
  string | null
>(storedDeckSelectedGroup);

export function setDeckSelectedGroup(group: string | null) {
  if (group === null) {
    localStorage.removeItem("deckSelectedGroup");
  } else {
    localStorage.setItem("deckSelectedGroup", group);
  }
  setDeckSelectedGroupInternal(group);
}
