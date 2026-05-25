import { CTEManager } from "./cte_manager.ts";
import {
  applyPostAggregationExpressionV2,
  buildMainQuery,
  buildNationalTotalQueryV2,
} from "./query_helpers.ts";
import type { QueryConfigV2 } from "./types.ts";

export function buildCombinedQueryV2(config: QueryConfigV2): string {
  const { tableName, fetchConfig, queryContext, limit } = config;

  // 1. Create CTE manager with CTEs registered based on query config
  const cteManager = CTEManager.fromQueryConfig(config);
  const periodCTEName = cteManager.getPeriodCTEName();
  const facilityCTEName = cteManager.getFacilityCTEName();
  const sourceTable = periodCTEName || tableName;

  // 3. Build main query with CTE names
  const mainQuery = buildMainQuery(
    sourceTable,
    fetchConfig,
    queryContext,
    facilityCTEName,
  );

  const nationalQuery = buildNationalTotalQueryV2(
    sourceTable,
    fetchConfig,
    queryContext,
    facilityCTEName,
  );

  // 4. Combine queries with UNION ALL if both exist
  let combinedQuery = mainQuery;
  if (nationalQuery) {
    combinedQuery = `${mainQuery}\nUNION ALL\n${nationalQuery}`;
  }

  // 5. Apply post-aggregation expression if present (v2 version)
  const queryWithPostAggregation = applyPostAggregationExpressionV2(
    combinedQuery,
    fetchConfig.postAggregationExpression,
    fetchConfig.groupBys,
  );

  // 6. Prepend WITH clause if any CTEs exist
  const withClause = cteManager.emitWITHClause();
  let finalQuery = withClause
    ? `${withClause}\n${queryWithPostAggregation}`
    : queryWithPostAggregation;

  // 7. Add LIMIT to prevent excessive data fetching
  finalQuery = `${finalQuery}\nLIMIT ${limit}`;

  return finalQuery;
}
