import { isDisaggregationOption, type DisaggregationOption, type PresentationObjectConfig } from "platform-lib";

export function isCentralDisaggregationOption(s: string): s is DisaggregationOption {
  return isDisaggregationOption(s) || s === "admin_area_1";
}

// REVERT NOTE: When "admin_area_1" is added to platform-lib's ALL_DISAGGREGATION_OPTIONS,
// delete this function and replace all uses of parseCentralPresentationObjectConfig with
// parsePresentationObjectConfig (re-exported from platform-lib).
//
// Bypasses Zod validation because platform-lib's schema rejects "admin_area_1" (not yet
// in its enum). Central-server configs are always written by the central-server itself
// so no external schema drift is possible.
export function parseCentralPresentationObjectConfig(raw: string): PresentationObjectConfig {
  return JSON.parse(raw) as PresentationObjectConfig;
}
