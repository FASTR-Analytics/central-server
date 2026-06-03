import { isDisaggregationOption, type DisaggregationOption } from "platform-lib";

export function isCentralDisaggregationOption(s: string): s is DisaggregationOption {
  return isDisaggregationOption(s) || s === "admin_area_1";
}
