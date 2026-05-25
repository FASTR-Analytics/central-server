import type { Sql } from "postgres";
import { getResultsObjectTableName, tryCatchDatabaseAsync, type APIResponseWithData } from "../db/utils.ts";
import type {
  GenericLongFormFetchConfig,
  ItemsHolderPresentationObject,
  PeriodOption,
} from "./lib_types.ts";
import { getPeriodFilterExactBounds } from "./lib_types.ts";
import { MAX_ITEMS } from "./consts.ts";
import { buildCombinedQueryV2 } from "./get_combined_query.ts";
import { getIndicatorMetadata } from "./get_indicator_metadata.ts";
import { getPeriodBounds } from "./get_period_bounds.ts";
import { buildQueryContext } from "./get_query_context.ts";
import { buildWhereClause } from "./query_helpers.ts";

export async function getPresentationObjectItems(
  mainDb: Sql,
  projectId: string,
  projectDb: Sql,
  resultsObjectId: string,
  fetchConfig: GenericLongFormFetchConfig,
  firstPeriodOption: PeriodOption | undefined,
  moduleLastRun: string,
): Promise<APIResponseWithData<ItemsHolderPresentationObject>> {
  return await tryCatchDatabaseAsync<ItemsHolderPresentationObject>(async () => {
    const roRow = (
      await projectDb<{ module_id: string }[]>`
SELECT module_id FROM results_objects WHERE id = ${resultsObjectId}
`
    ).at(0);
    if (!roRow) throw new Error(`Unknown results object: ${resultsObjectId}`);
    const moduleId = roRow.module_id;

    const tableName = getResultsObjectTableName(resultsObjectId);

    const queryContext = await buildQueryContext(
      mainDb,
      projectDb,
      tableName,
      fetchConfig,
    );

    ///////////////////////////
    //                       //
    //    Additional info    //
    //                       //
    ///////////////////////////

    const indicatorMetadata = await getIndicatorMetadata(
      mainDb,
      projectDb,
      moduleId,
    );

    const nonFacilityFetchConfig = {
      ...fetchConfig,
      filters: queryContext.nonFacilityFilters,
    };

    const nonFacilityWhereStatements = buildWhereClause(
      nonFacilityFetchConfig,
      queryContext.hasPeriodId,
    );

    const rawDateRange = await getPeriodBounds(
      projectDb,
      tableName,
      nonFacilityWhereStatements,
      firstPeriodOption,
      queryContext.hasPeriodId,
    );

    ///////////////////////////
    //                       //
    //    Resolve filter     //
    //                       //
    ///////////////////////////

    const periodFilterExactBounds = getPeriodFilterExactBounds(
      fetchConfig.periodFilter,
      rawDateRange,
    );

    // Use resolved period bounds as dateRange when period filter is active
    const dateRange = periodFilterExactBounds ?? rawDateRange;

    // If metric has time data but we couldn't determine valid period bounds,
    // treat as no data available (prevents null period crashes downstream)
    if (firstPeriodOption && !dateRange) {
      const ih: ItemsHolderPresentationObject = {
        projectId,
        resultsObjectId,
        fetchConfig,
        moduleLastRun,
        dateRange: undefined,
        status: "no_data_available" as const,
      };
      return { success: true, data: ih };
    }

    const resolvedFetchConfig = {
      ...fetchConfig,
      periodFilterExactBounds,
    };

    ///////////////////////////
    //                       //
    //    Execute query      //
    //                       //
    ///////////////////////////

    const sqlQuery = buildCombinedQueryV2({
      tableName,
      fetchConfig: resolvedFetchConfig,
      queryContext,
      limit: MAX_ITEMS + 1, // Fetch one extra to detect if limit exceeded
    });

    // Execute the query
    const rawItems = await projectDb.unsafe(sqlQuery);

    // Check for special states
    if (rawItems.length > MAX_ITEMS) {
      const ih: ItemsHolderPresentationObject = {
        projectId,
        resultsObjectId,
        fetchConfig,
        moduleLastRun,
        dateRange,
        status: "too_many_items" as const,
      };
      return { success: true, data: ih };
    }

    if (rawItems.length === 0) {
      const ih: ItemsHolderPresentationObject = {
        projectId,
        resultsObjectId,
        fetchConfig,
        moduleLastRun,
        dateRange,
        status: "no_data_available" as const,
      };
      return { success: true, data: ih };
    }

    const ih: ItemsHolderPresentationObject = {
      projectId,
      resultsObjectId,
      fetchConfig,
      moduleLastRun,
      dateRange,
      status: "ok" as const,
      items: rawItems as Record<string, string>[],
      indicatorMetadata,
    };

    return { success: true, data: ih };
  });
}
