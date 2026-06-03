import type { PresentationObjectConfig } from "platform-lib";

export function getAdminAreaLevelFromMapConfig(
  config: PresentationObjectConfig,
): number | undefined {
  if (config.d.type !== "map") return undefined;
  for (const dis of config.d.disaggregateBy) {
    if (dis.disDisplayOpt === "mapArea") {
      if ((dis.disOpt as string) === "admin_area_1") return 1;
      if (dis.disOpt === "admin_area_2") return 2;
      if (dis.disOpt === "admin_area_3") return 3;
      if (dis.disOpt === "admin_area_4") return 4;
    }
  }
  return undefined;
}
