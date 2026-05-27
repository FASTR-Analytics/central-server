import { Hono } from "hono";
import type { GlobalUser, CentralExportPayload } from "lib";
import { getPgConnectionFromCacheOrNew, getResultsObjectTableName, initProjectDb, type DBProject } from "../../db/mod.ts";
import { requireHUser } from "../../middleware/auth.ts";

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

export async function doImport(
  payload: CentralExportPayload & { targetProjectId: string },
  email: string,
): Promise<{ success: true; data: { nResultsObjects: number; nRowsTotal: number } } | { success: false; err: string; status?: number }> {
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
          ${m.id}, ${m.module_definition}, ${m.config_selections}, 'complete',
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

      await projectDb`
        INSERT INTO results_objects (id, module_id, column_definitions)
        VALUES (${ro.id}, ${ro.moduleId}, ${ro.columnDefinitions})
        ON CONFLICT (id) DO UPDATE SET
          column_definitions = EXCLUDED.column_definitions
      `;

      const colDefs: Record<string, string> = ro.columnDefinitions ? JSON.parse(ro.columnDefinitions) : {};
      const columnsSql = Object.entries(colDefs).map(([name, typedef]) => `${name} ${typedef.replace(/\s+NOT NULL/gi, "")}`).join(", ");
      const createSql = columnsSql
        ? `CREATE TABLE IF NOT EXISTS ${tableName} (source_server_id TEXT NOT NULL, ${columnsSql})`
        : `CREATE TABLE IF NOT EXISTS ${tableName} (source_server_id TEXT NOT NULL)`;
      await projectDb.unsafe(createSql);
      for (const colName of Object.keys(colDefs)) {
        await projectDb.unsafe(`ALTER TABLE ${tableName} ALTER COLUMN "${colName}" DROP NOT NULL`);
      }

      await projectDb.unsafe(`DELETE FROM ${tableName} WHERE source_server_id = $1`, [sourceInstanceId]);

      if (ro.rows.length > 0) {
        const columns = ["source_server_id", ...Object.keys(ro.rows[0])];
        const values = ro.rows.map((row: Record<string, unknown>) => [sourceInstanceId, ...Object.values(row)]);
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
            ${ci.calculated_indicator_id}, ${ci.label}, ${ci.format_as}, ${ci.decimal_places},
            ${ci.threshold_direction}, ${ci.threshold_green}, ${ci.threshold_yellow},
            ${ci.group_label}, ${ci.sort_order}
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

    await mainDb`
      INSERT INTO import_history (
        source_server_id, source_server_label, source_project_id,
        target_project_id, imported_by, n_results_objects, n_rows_total, status
      ) VALUES (
        ${sourceInstanceId}, ${sourceInstanceLabel}, ${sourceProjectId},
        ${targetProjectId}, ${email}, ${nResultsObjects}, ${nRowsTotal}, 'success'
      )
    `;

    return { success: true, data: { nResultsObjects, nRowsTotal } };
  } catch (error) {
    await mainDb`
      INSERT INTO import_history (
        source_server_id, source_server_label, source_project_id,
        target_project_id, imported_by, n_results_objects, n_rows_total, status
      ) VALUES (
        ${sourceInstanceId}, ${sourceInstanceLabel}, ${sourceProjectId},
        ${targetProjectId}, ${email}, ${nResultsObjects}, ${nRowsTotal}, 'failed'
      )
    `.catch(() => {});
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
  return c.json(result);
});
