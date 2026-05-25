import type { Sql } from "postgres";
import type { IndicatorMetadata } from "./lib_types.ts";

export async function getIndicatorMetadata(
  _mainDb: Sql,
  _projectDb: Sql,
  _moduleId: string,
): Promise<IndicatorMetadata[]> {
  return [];
}
