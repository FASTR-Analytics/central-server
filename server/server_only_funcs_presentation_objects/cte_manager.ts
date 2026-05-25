import { PERIOD_COLUMN_EXPRESSIONS, QUARTER_ID_COLUMN_EXPRESSIONS, getQuarterIdExpression } from "./period_helpers.ts";
import type { QueryConfigV2 } from "./types.ts";

// ============================================================================
// CTE Manager - Centralized Common Table Expression Management
// ============================================================================

/**
 * Manages Common Table Expressions (CTEs) to ensure proper SQL syntax
 * when multiple CTEs are needed. Prevents conflicts when combining queries
 * with UNION ALL operations.
 */
export class CTEManager {
  private ctes: Map<string, string> = new Map();
  private periodCTEName?: string;
  private facilityCTEName?: string;

  /**
   * Registers a CTE with the manager
   * @param name - The CTE name (e.g., 'period_data', 'facility_subset')
   * @param definition - The CTE definition SQL (SELECT statement only)
   * @throws Error if CTE name already exists with different definition
   */
  private register(name: string, definition: string): void {
    const cleanDefinition = definition.trim();

    if (this.ctes.has(name)) {
      const existing = this.ctes.get(name)!;
      if (existing !== cleanDefinition) {
        throw new Error(
          `CTE '${name}' already registered with different definition`
        );
      }
      // Same definition, no need to re-register
      return;
    }

    this.ctes.set(name, cleanDefinition);
  }

  /**
   * Generates the complete WITH clause for all registered CTEs
   * @returns Complete WITH clause or null if no CTEs are registered
   */
  emitWITHClause(): string | null {
    if (this.ctes.size === 0) {
      return null;
    }

    const entries = Array.from(this.ctes.entries());
    const cteDefinitions = entries.map(([name, definition]) => {
      return `${name} AS (\n  ${definition}\n)`;
    });

    return `WITH ${cteDefinitions.join(",\n     ")}`;
  }

  /**
   * Creates a CTE manager with CTEs automatically registered based on query configuration
   * @param config - Query configuration containing context about needed CTEs
   * @returns CTEManager with appropriate CTEs registered
   */
  static fromQueryConfig(config: QueryConfigV2): CTEManager {
    const { tableName, queryContext } = config;
    const manager = new CTEManager();

    // 1. Build and register period CTE if needed
    if (queryContext.needsPeriodCTE) {
      const selectColumns: string[] = ["*"];

      if (queryContext.hasPeriodId) {
        if (queryContext.neededPeriodColumns.has("year")) {
          selectColumns.push(`${PERIOD_COLUMN_EXPRESSIONS.year} AS year`);
        }
        if (queryContext.neededPeriodColumns.has("month")) {
          selectColumns.push(`${PERIOD_COLUMN_EXPRESSIONS.month} AS month`);
        }
        if (queryContext.neededPeriodColumns.has("quarter_id")) {
          selectColumns.push(
            `${getQuarterIdExpression()} AS quarter_id`
          );
        }
      } else if (queryContext.hasQuarterId) {
        if (queryContext.neededPeriodColumns.has("year")) {
          selectColumns.push(`${QUARTER_ID_COLUMN_EXPRESSIONS.year} AS year`);
        }
      }

      const periodDefinition = `SELECT ${selectColumns.join(
        ", "
      )}\n  FROM ${tableName}`;
      manager.register("period_data", periodDefinition);
      manager.periodCTEName = "period_data";
    }

    // 2. No facility CTE needed in central-server (needsFacilityJoin is always false)

    return manager;
  }

  /**
   * Gets the period CTE name if one was registered
   * @returns Period CTE name or undefined
   */
  getPeriodCTEName(): string | undefined {
    return this.periodCTEName;
  }

  /**
   * Gets the facility CTE name if one was registered
   * @returns Facility CTE name or undefined
   */
  getFacilityCTEName(): string | undefined {
    return this.facilityCTEName;
  }
}
