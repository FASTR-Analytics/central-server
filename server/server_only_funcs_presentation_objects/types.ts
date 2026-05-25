import type { GenericLongFormFetchConfig } from "./lib_types.ts";
import type { DynamicPeriodColumn } from "./period_helpers.ts";

export interface QueryConfigV2 {
  tableName: string;
  fetchConfig: GenericLongFormFetchConfig;
  queryContext: QueryContext;
  limit: number;
}

export interface QueryContext {
  hasPeriodId: boolean;
  hasQuarterId: boolean;
  needsFacilityJoin: false;
  enabledFacilityColumns: never[];
  requestedOptionalFacilityColumns: never[];
  neededPeriodColumns: Set<DynamicPeriodColumn>;
  needsPeriodCTE: boolean;
  nonFacilityFilters: GenericLongFormFetchConfig["filters"];
  facilityFilters: [];
}
