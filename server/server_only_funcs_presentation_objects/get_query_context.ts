import type { Sql } from "postgres";
import { detectHasPeriodId, detectColumnExists } from "../db/utils.ts";
import type { GenericLongFormFetchConfig } from "./lib_types.ts";
import { detectNeededPeriodColumns } from "./period_helpers.ts";
import type { QueryContext } from "./types.ts";

export async function buildQueryContext(
  _mainDb: Sql,
  projectDb: Sql,
  tableName: string,
  fetchConfig: GenericLongFormFetchConfig,
): Promise<QueryContext> {
  const hasPeriodId = await detectHasPeriodId(projectDb, tableName);
  const hasQuarterId = !hasPeriodId && await detectColumnExists(projectDb, tableName, "quarter_id");
  const neededPeriodColumns = detectNeededPeriodColumns(fetchConfig);
  const needsPeriodCTE = (hasPeriodId && neededPeriodColumns.size > 0) || (hasQuarterId && neededPeriodColumns.has("year"));

  return {
    hasPeriodId,
    hasQuarterId,
    needsFacilityJoin: false,
    enabledFacilityColumns: [],
    requestedOptionalFacilityColumns: [],
    neededPeriodColumns,
    needsPeriodCTE,
    nonFacilityFilters: fetchConfig.filters,
    facilityFilters: [],
  };
}
