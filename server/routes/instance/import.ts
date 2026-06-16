import { Hono } from "hono";
import type { Sql } from "postgres";
import type { GlobalUser, CentralExportPayload } from "lib";
import { getPgConnectionFromCacheOrNew, getResultsObjectTableName, initProjectDb, type DBProject } from "../../db/mod.ts";
import { requireHUser } from "../../middleware/auth.ts";
import { notifyInstanceProjectsLastUpdated } from "../../task_management/notify_instance_updated.ts";
import {
  refetchAndNotifyImportHistory,
  refetchAndNotifyMetrics,
} from "../../task_management/refetch_and_notify.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export const routesImport = new Hono<Env>();

function buildBulkInsert(tableName: string, columns: string[], nRows: number): string {
  const colList = columns.join(", ");
  const rows: string[] = [];
  let paramIdx = 1;
  for (let r = 0; r < nRows; r++) {
    const params = columns.map(() => `$${paramIdx++}`);
    rows.push(`(${params.join(", ")})`);
  }
  return `INSERT INTO ${tableName} (${colList}) VALUES ${rows.join(", ")}`;
}

// Encode one value for Postgres COPY ... FROM STDIN in the default TEXT format:
// NULL is "\N", objects become JSON (for jsonb columns), everything else is
// stringified; then the structural characters are backslash-escaped (backslash
// first, so the others aren't double-escaped).
export function encodeCopyValue(v: unknown): string {
  if (v === null || v === undefined) return "\\N";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

// The target table only carries the columns defined at import time — redundant
// period columns (year/quarter_id/month) are dropped in doImport. Source rows
// still include those columns, so callers filter to what the table actually has.
// Looking this up once per results object (rather than per batch) avoids a catalog
// round-trip on every batch.
export async function getTableColumns(projectDb: Sql, tableName: string): Promise<Set<string>> {
  const rows = await projectDb.unsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName.replace(/^public\./, "").replace(/"/g, "")],
  ) as { column_name: string }[];
  return new Set(rows.map((r) => r.column_name));
}

// Bulk-load a batch of rows via Postgres COPY — dramatically faster than multi-row
// INSERT. `allowedColumns` are the table's data columns (excluding source_server_id)
// and must already exist in the table; values absent from a row become NULL. A COPY
// command is atomic, so a failed batch leaves no partial rows and is safe to retry.
export async function copyInsert(
  projectDb: Sql,
  tableName: string,
  allowedColumns: string[],
  rows: Record<string, unknown>[],
  sourceInstanceId: string,
): Promise<void> {
  if (rows.length === 0) return;
  const cols = ["source_server_id", ...allowedColumns];
  const writable = await projectDb`COPY ${projectDb(tableName)} (${projectDb(cols)}) FROM STDIN`.writable();

  let payload = "";
  for (const row of rows) {
    payload += encodeCopyValue(sourceInstanceId);
    for (const k of allowedColumns) payload += "\t" + encodeCopyValue(row[k]);
    payload += "\n";
  }

  await new Promise<void>((resolve, reject) => {
    writable.on("error", reject);
    writable.on("finish", () => resolve());
    writable.write(payload, (err: Error | null | undefined) => {
      if (err) reject(err);
    });
    writable.end();
  });
}

export async function doImport(
  payload: CentralExportPayload & { targetProjectId: string },
  email: string,
  options?: { recordHistory?: boolean },
): Promise<{ success: true; data: { nResultsObjects: number; nRowsTotal: number } } | { success: false; err: string; status?: number }> {
  // Callers that stream rows themselves (the central pull path) record their own
  // history after the rows actually land, so doImport must not write a premature
  // success row here.
  const recordHistory = options?.recordHistory ?? true;
  const { sourceInstanceId, sourceInstanceLabel, sourceProjectId, modules, resultsObjects, metrics, calculatedIndicators, targetProjectId } = payload;

  if (!targetProjectId) return { success: false, err: "targetProjectId required", status: 400 };

  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");

  const projectRow = await mainDb<DBProject[]>`SELECT * FROM projects WHERE id = ${targetProjectId}`;
  const project = projectRow.at(0);
  if (!project) return { success: false, err: "Target project not found", status: 404 };
  if (project.is_locked) return { success: false, err: "Project is locked. Unlock it before importing.", status: 409 };

  // Ensure the project database exists (it may not if the server was restarted after creation)
  const postgresDb = getPgConnectionFromCacheOrNew("postgres", "READ_AND_WRITE");
  const dbExists = await postgresDb<{ datname: string }[]>`
    SELECT datname FROM pg_catalog.pg_database WHERE datname = ${targetProjectId}
  `;
  if (dbExists.length === 0) {
    await postgresDb.unsafe(`CREATE DATABASE "${targetProjectId.replace(/"/g, "")}"`);
  }
  const projectDb = getPgConnectionFromCacheOrNew(targetProjectId, "READ_AND_WRITE");
  await initProjectDb(projectDb);
  let nResultsObjects = 0;
  let nRowsTotal = 0;

  try {
    for (const m of modules) {
      await projectDb`
        INSERT INTO modules (
          id, module_definition, config_selections, dirty,
          compute_def_updated_at, compute_def_git_ref,
          presentation_def_updated_at, presentation_def_git_ref,
          config_updated_at, last_run_at, last_run_git_ref
        ) VALUES (
          ${m.id}, ${m.module_definition ?? ""}, ${m.config_selections}, 'complete',
          ${m.compute_def_updated_at}, ${m.compute_def_git_ref},
          ${m.presentation_def_updated_at}, ${m.presentation_def_git_ref},
          ${m.config_updated_at}, ${m.last_run_at}, ${m.last_run_git_ref}
        )
        ON CONFLICT (id) DO UPDATE SET
          module_definition = EXCLUDED.module_definition,
          config_selections = EXCLUDED.config_selections,
          dirty = 'complete',
          compute_def_updated_at = EXCLUDED.compute_def_updated_at,
          compute_def_git_ref = EXCLUDED.compute_def_git_ref,
          presentation_def_updated_at = EXCLUDED.presentation_def_updated_at,
          presentation_def_git_ref = EXCLUDED.presentation_def_git_ref,
          config_updated_at = EXCLUDED.config_updated_at,
          last_run_at = EXCLUDED.last_run_at,
          last_run_git_ref = EXCLUDED.last_run_git_ref
      `;
    }

    for (const ro of resultsObjects) {
      const tableName = getResultsObjectTableName(ro.id);

      const colDefs: Record<string, string> = ro.columnDefinitions ? JSON.parse(ro.columnDefinitions) : {};

      // Mirror platform behaviour: keep only the most granular time column.
      // period_id > quarter_id > year; drop the others so derived columns are
      // always computed on-the-fly via the period CTE.
      const hasPeriodId = "period_id" in colDefs;
      const hasQuarterId = !hasPeriodId && "quarter_id" in colDefs;
      const periodColsToDrop: string[] = hasPeriodId
        ? ["year", "quarter_id", "month"]
        : hasQuarterId
        ? ["year", "month"]
        : ["month", "quarter_id"];
      for (const col of periodColsToDrop) {
        delete colDefs[col];
      }

      await projectDb`
        INSERT INTO results_objects (id, module_id, column_definitions)
        VALUES (${ro.id}, ${ro.moduleId}, ${JSON.stringify(colDefs)})
        ON CONFLICT (id) DO UPDATE SET
          column_definitions = EXCLUDED.column_definitions
      `;

      const columnsSql = Object.entries(colDefs).map(([name, typedef]) => `${name} ${typedef.replace(/\s+NOT NULL/gi, "")}`).join(", ");
      const createSql = columnsSql
        ? `CREATE TABLE IF NOT EXISTS ${tableName} (source_server_id TEXT NOT NULL, ${columnsSql})`
        : `CREATE TABLE IF NOT EXISTS ${tableName} (source_server_id TEXT NOT NULL)`;
      await projectDb.unsafe(createSql);
      for (const colName of Object.keys(colDefs)) {
        await projectDb.unsafe(`ALTER TABLE ${tableName} ALTER COLUMN "${colName}" DROP NOT NULL`);
      }

      // Drop redundant period columns from tables that existed before this logic
      // was introduced (re-import case).
      if (periodColsToDrop.length > 0) {
        const dropClauses = periodColsToDrop.map((col) => `DROP COLUMN IF EXISTS "${col}"`).join(", ");
        await projectDb.unsafe(`ALTER TABLE ${tableName} ${dropClauses}`);
      }

      await projectDb.unsafe(`DELETE FROM ${tableName} WHERE source_server_id = $1`, [sourceInstanceId]);

      if (ro.rows.length > 0) {
        const colDefsKeys = new Set(Object.keys(colDefs));
        const rowKeys = Object.keys(ro.rows[0]).filter((k) => colDefsKeys.has(k));
        const columns = ["source_server_id", ...rowKeys];
        const values = ro.rows.map((row: Record<string, unknown>) => [sourceInstanceId, ...rowKeys.map((k) => row[k])]);
        const chunkSize = 500;
        for (let i = 0; i < values.length; i += chunkSize) {
          const chunk = values.slice(i, i + chunkSize);
          await projectDb.unsafe(
            buildBulkInsert(tableName, columns, chunk.length),
            chunk.flat() as (string | number | boolean | null)[],
          );
        }
        nRowsTotal += ro.rows.length;
      }
      nResultsObjects++;
    }

    for (const m of metrics) {
      await projectDb`
        INSERT INTO metrics (
          id, module_id, label, variant_label, value_func, format_as,
          value_props, required_disaggregation_options, value_label_replacements,
          post_aggregation_expression, results_object_id, ai_description,
          viz_presets, hide, important_notes
        ) VALUES (
          ${m.id}, ${m.module_id}, ${m.label}, ${m.variant_label}, ${m.value_func},
          ${m.format_as}, ${m.value_props}, ${m.required_disaggregation_options},
          ${m.value_label_replacements}, ${m.post_aggregation_expression},
          ${m.results_object_id}, ${m.ai_description}, ${m.viz_presets},
          ${m.hide}, ${m.important_notes}
        )
        ON CONFLICT (id) DO UPDATE SET
          label = EXCLUDED.label,
          variant_label = EXCLUDED.variant_label,
          value_func = EXCLUDED.value_func,
          format_as = EXCLUDED.format_as,
          value_props = EXCLUDED.value_props,
          required_disaggregation_options = EXCLUDED.required_disaggregation_options,
          value_label_replacements = EXCLUDED.value_label_replacements,
          post_aggregation_expression = EXCLUDED.post_aggregation_expression,
          results_object_id = EXCLUDED.results_object_id,
          ai_description = EXCLUDED.ai_description,
          viz_presets = EXCLUDED.viz_presets,
          hide = EXCLUDED.hide,
          important_notes = EXCLUDED.important_notes
      `;
    }

    if (calculatedIndicators?.length) {
      for (const ci of calculatedIndicators) {
        await projectDb`
          INSERT INTO calculated_indicators_snapshot (
            calculated_indicator_id, label, format_as, decimal_places,
            threshold_direction, threshold_green, threshold_yellow, group_label, sort_order
          ) VALUES (
            ${ci.calculated_indicator_id}, ${ci.label ?? ""}, ${ci.format_as ?? "number"}, ${ci.decimal_places ?? 0},
            ${ci.threshold_direction ?? "higher_is_better"}, ${ci.threshold_green ?? 0}, ${ci.threshold_yellow ?? 0},
            ${ci.group_label ?? ""}, ${ci.sort_order ?? 0}
          )
          ON CONFLICT (calculated_indicator_id) DO UPDATE SET
            label = EXCLUDED.label,
            format_as = EXCLUDED.format_as,
            decimal_places = EXCLUDED.decimal_places,
            threshold_direction = EXCLUDED.threshold_direction,
            threshold_green = EXCLUDED.threshold_green,
            threshold_yellow = EXCLUDED.threshold_yellow,
            group_label = EXCLUDED.group_label,
            sort_order = EXCLUDED.sort_order
        `;
      }
    }

    if (recordHistory) {
      await mainDb`
        INSERT INTO import_history (
          source_server_id, source_server_label, source_project_id,
          target_project_id, imported_by, n_results_objects, n_rows_total, status
        ) VALUES (
          ${sourceInstanceId}, ${sourceInstanceLabel}, ${sourceProjectId},
          ${targetProjectId}, ${email}, ${nResultsObjects}, ${nRowsTotal}, 'success'
        )
      `;
    }

    return { success: true, data: { nResultsObjects, nRowsTotal } };
  } catch (error) {
    if (recordHistory) {
      await mainDb`
        INSERT INTO import_history (
          source_server_id, source_server_label, source_project_id,
          target_project_id, imported_by, n_results_objects, n_rows_total, status
        ) VALUES (
          ${sourceInstanceId}, ${sourceInstanceLabel}, ${sourceProjectId},
          ${targetProjectId}, ${email}, ${nResultsObjects}, ${nRowsTotal}, 'failed'
        )
      `.catch(() => {});
    }
    console.error("Import failed:", error);
    return { success: false, err: error instanceof Error ? error.message : "Import failed" };
  }
}

routesImport.post("/import_result_objects", requireHUser(), async (c) => {
  const body = await c.req.json<CentralExportPayload & { targetProjectId: string }>();
  const result = await doImport(body, c.var.globalUser.email);
  if (!result.success) {
    return c.json(result, (result.status ?? 500) as 400 | 404 | 409 | 500);
  }
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");
  const projectDb = getPgConnectionFromCacheOrNew(body.targetProjectId, "READ_ONLY");
  await refetchAndNotifyMetrics(projectDb, body.targetProjectId);
  await refetchAndNotifyImportHistory(mainDb, body.targetProjectId);
  notifyInstanceProjectsLastUpdated();
  return c.json(result);
});
