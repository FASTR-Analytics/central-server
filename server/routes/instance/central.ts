import { Hono } from "hono";
import type { GlobalUser, CentralExportPayload } from "lib";
import { requireHUser } from "../../middleware/auth.ts";
import { doImport, insertRowsChunk } from "./import.ts";
import { getPgConnectionFromCacheOrNew, getResultsObjectTableName } from "../../db/mod.ts";
import { _CENTRAL_SERVER_SECRET } from "../../exposed_env_vars.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export const routesCentral = new Hono<Env>();

routesCentral.get("/servers.json", async (c) => {
  try {
    const content = await Deno.readTextFile("/app/servers.json");
    return c.json(JSON.parse(content));
  } catch {
    return c.json([]);
  }
});

routesCentral.get("/central_reporting_projects/:sourceServerId", requireHUser(), async (c) => {
  const sourceServerId = c.req.param("sourceServerId");
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ success: false, err: "No auth token" }, 401);

  try {
    const response = await fetch(
      `https://${sourceServerId}.fastr-analytics.org/central_reporting_projects`,
      { headers: { Authorization: authHeader } },
    );
    const data = await response.json();
    return c.json(data, response.status as 200 | 401 | 403 | 404 | 500);
  } catch (error) {
    return c.json({ success: false, err: `Failed to reach ${sourceServerId}: ${String(error)}` }, 502);
  }
});

routesCentral.post("/import_from_source", requireHUser(), async (c) => {
  const body = await c.req.json<{ sourceServerId: string; sourceProjectId: string; targetProjectId: string }>();
  const { sourceServerId, sourceProjectId, targetProjectId } = body;

  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ success: false, err: "No auth token" }, 401);

  // Decode JWT payload to log expiry (no verification — just for diagnostics)
  try {
    const jwtPayload = JSON.parse(atob(authHeader.replace("Bearer ", "").split(".")[1]));
    const expiresAt = new Date(jwtPayload.exp * 1000);
    console.log(`[import] token expires at ${expiresAt.toISOString()} (in ${Math.round((expiresAt.getTime() - Date.now()) / 1000)}s)`);
  } catch { /* non-fatal */ }

  const importStart = Date.now();

  let exportPayload: CentralExportPayload;
  try {
    const exportResponse = await fetch(
      `https://${sourceServerId}.fastr-analytics.org/export_central/${sourceProjectId}`,
      { headers: { Authorization: authHeader } },
    );
    if (!exportResponse.ok) {
      const text = await exportResponse.text();
      return c.json({ success: false, err: `Export failed (${exportResponse.status}): ${text}` }, 502);
    }
    const exportJson = await exportResponse.json();
    exportPayload = exportJson.data ?? exportJson;
    if (!exportPayload || !Array.isArray(exportPayload.modules)) {
      return c.json({ success: false, err: `Unexpected export response from ${sourceServerId}: ${JSON.stringify(exportPayload).slice(0, 300)}` }, 502);
    }
    console.log(`[import] export metadata fetched in ${Date.now() - importStart}ms — ${exportPayload.resultsObjects.length} results objects`);
  } catch (error) {
    return c.json({ success: false, err: `Failed to reach ${sourceServerId}: ${String(error)}` }, 502);
  }

  // Fetch all rows before doImport so the auth token (short-lived Clerk JWT) is
  // still valid. doImport can take tens of seconds for large countries, which
  // would cause the token to expire before the rows fetches start.
  const ROWS_PAGE_SIZE = 20000;
  const prefetchedRows = new Map<string, Record<string, unknown>[]>();

  for (const ro of exportPayload.resultsObjects) {
    const rows: Record<string, unknown>[] = [];
    let offset = 0;
    console.log(`[import] fetching rows for ${ro.id} at +${Date.now() - importStart}ms`);
    while (true) {
      const rowsRes = await fetch(
        `https://${sourceServerId}.fastr-analytics.org/export_central/${sourceProjectId}/rows?ro_id=${encodeURIComponent(ro.id)}&offset=${offset}`,
        { headers: { "X-Central-Secret": _CENTRAL_SERVER_SECRET } },
      );
      if (!rowsRes.ok) {
        const text = await rowsRes.text().catch(() => "");
        console.error(`[import] 401/error for ${ro.id} at +${Date.now() - importStart}ms`);
        return c.json({ success: false, err: `Failed to fetch rows for results object ${ro.id} (${rowsRes.status}): ${text.slice(0, 200)}` }, 502);
      }
      const rowsJson = await rowsRes.json() as { success: boolean; data?: { rows: Record<string, unknown>[]; hasMore: boolean } };
      if (!rowsJson.success || !rowsJson.data) {
        return c.json({ success: false, err: `Rows endpoint returned failure for results object ${ro.id}: ${JSON.stringify(rowsJson).slice(0, 200)}` }, 502);
      }
      rows.push(...rowsJson.data.rows);
      if (!rowsJson.data.hasMore) break;
      offset += ROWS_PAGE_SIZE;
    }
    console.log(`[import] ${ro.id}: ${rows.length} rows total`);
    prefetchedRows.set(ro.id, rows);
  }

  const result = await doImport({ ...exportPayload, targetProjectId }, c.var.globalUser.email);
  if (!result.success) {
    return c.json(result, (result.status ?? 500) as 400 | 404 | 409 | 500);
  }

  const projectDb = getPgConnectionFromCacheOrNew(targetProjectId, "READ_AND_WRITE");

  for (const ro of exportPayload.resultsObjects) {
    const tableName = getResultsObjectTableName(ro.id);
    const rows = prefetchedRows.get(ro.id) ?? [];
    await insertRowsChunk(projectDb, tableName, rows, exportPayload.sourceInstanceId);
  }

  return c.json(result);
});
