import {
  type CfStorage,
  type ConditionalFormatting,
  flattenCf,
  type PresentationObjectConfig,
} from "platform-lib";
import { batch } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";

export function applyCfToTempConfig(
  setTempConfig: SetStoreFunction<PresentationObjectConfig>,
  cf: ConditionalFormatting,
): void {
  const flat = flattenCf(cf);
  batch(() => {
    (Object.keys(flat) as (keyof CfStorage)[]).forEach((k) => {
      (setTempConfig as unknown as (
        path: "s",
        key: keyof CfStorage,
        value: CfStorage[keyof CfStorage],
      ) => void)("s", k, flat[k]);
    });
  });
}
