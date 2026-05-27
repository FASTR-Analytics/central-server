import type { Sql } from "postgres";
import type { IndicatorMetadata } from "./lib_types.ts";
import type { DBCalculatedIndicatorSnapshot } from "../db/project/_project_database_types.ts";

export async function getIndicatorMetadata(
  _mainDb: Sql,
  projectDb: Sql,
  _moduleId: string,
): Promise<IndicatorMetadata[]> {
  try {
    const rows = await projectDb<DBCalculatedIndicatorSnapshot[]>`
      SELECT * FROM calculated_indicators_snapshot ORDER BY sort_order, calculated_indicator_id
    `;
    return rows.map((row) => ({
      id: row.calculated_indicator_id,
      label: row.label,
      format_as: row.format_as,
      decimal_places: row.decimal_places,
      threshold_direction: row.threshold_direction,
      threshold_green: row.threshold_green,
      threshold_yellow: row.threshold_yellow,
      group_label: row.group_label,
      sort_order: row.sort_order,
    }));
  } catch {
    return [];
  }
}
