import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { GlobalUser, CentralExportPayload } from "lib";
import { requireHUser } from "../../middleware/auth.ts";
import { doImport, insertRowsChunk } from "./import.ts";
import { getPgConnectionFromCacheOrNew, getResultsObjectTableName } from "../../db/mod.ts";
import { _BYPASS_AUTH, _CENTRAL_SERVER_SECRET, _SERVERS_FILE_PATH } from "../../exposed_env_vars.ts";
import { notifyInstanceProjectsLastUpdated } from "../../task_management/notify_instance_updated.ts";
import {
  refetchAndNotifyImportHistory,
  refetchAndNotifyMetrics,
} from "../../task_management/refetch_and_notify.ts";

type Env = { Variables: { globalUser: GlobalUser } };

type ImportProgressEvent =
  | { type: "fetching"; roId: string; index: number; total: number; rowsFetched: number }
  | { type: "importing" }
  | { type: "inserting"; index: number; total: number }
  | { type: "done"; nResultsObjects: number; nRowsTotal: number }
  | { type: "error"; err: string };

const pendingImports = new Map<string, {
  authHeader: string;
  sourceServerId: string;
  sourceProjectId: string;
  targetProjectId: string;
}>();

export const routesCentral = new Hono<Env>();

routesCentral.get("/servers.json", async (c) => {
  try {
    const content = await Deno.readTextFile(_SERVERS_FILE_PATH);
    return c.json(JSON.parse(content));
  } catch {
    return c.json([]);
  }
});

routesCentral.get("/central_reporting_projects/:sourceServerId", requireHUser(), async (c) => {
  const sourceServerId = c.req.param("sourceServerId");
  const authHeader = c.req.header("Authorization");
  if (!authHeader && !_BYPASS_AUTH) return c.json({ success: false, err: "No auth token" }, 401);

  try {
    const response = await fetch(
      `https://${sourceServerId}.fastr-analytics.org/central_reporting_projects`,
      { headers: authHeader ? { Authorization: authHeader } : {} },
    );
    const data = await response.json();
    return c.json(data, response.status as 200 | 401 | 403 | 404 | 500);
  } catch (error) {
    return c.json({ success: false, err: `Failed to reach ${sourceServerId}: ${String(error)}` }, 502);
  }
});

routesCentral.post("/import_from_source", requireHUser(), async (c) => {
  const body = await c.req.json<{ sourceServerId: string; sourceProjectId: string; targetProjectId: string }>();
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ success: false, err: "No auth token" }, 401);

  const jobId = crypto.randomUUID();
  pendingImports.set(jobId, { authHeader, ...body });

  runImportJob(jobId);

  return c.json({ success: true, data: { jobId } });
});

routesCentral.get("/import_progress/:jobId", requireHUser(), async (c) => {
  const jobId = c.req.param("jobId");
  return streamSSE(c, async (stream) => {
    const channel = new BroadcastChannel(`import:${jobId}`);
    let resolve: (() => void) | null = null;
    const queue: ImportProgressEvent[] = [];

    channel.onmessage = (evt: MessageEvent<ImportProgressEvent>) => {
      queue.push(evt.data);
      resolve?.();
    };

    try {
      while (true) {
        while (queue.length > 0) {
          const event = queue.shift()!;
          await stream.writeSSE({ data: JSON.stringify(event) });
          if (event.type === "done" || event.type === "error") return;
        }
        await new Promise<void>((r) => { resolve = r; });
        resolve = null;
      }
    } finally {
      channel.close();
    }
  });
});

async function runImportJob(jobId: string) {
  const job = pendingImports.get(jobId);
  if (!job) return;
  pendingImports.delete(jobId);

  const channel = new BroadcastChannel(`import:${jobId}`);
  const send = (event: ImportProgressEvent) => channel.postMessage(event);

  try {
    const { authHeader, sourceServerId, sourceProjectId, targetProjectId } = job;

    const exportResponse = await fetch(
      `https://${sourceServerId}.fastr-analytics.org/export_central/${sourceProjectId}`,
      { headers: { Authorization: authHeader } },
    );
    if (!exportResponse.ok) {
      const text = await exportResponse.text();
      send({ type: "error", err: `Export failed (${exportResponse.status}): ${text.slice(0, 200)}` });
      return;
    }
    const exportJson = await exportResponse.json();
    const exportPayload: CentralExportPayload = exportJson.data ?? exportJson;
    if (!exportPayload || !Array.isArray(exportPayload.modules)) {
      send({ type: "error", err: `Unexpected export response from ${sourceServerId}: ${JSON.stringify(exportPayload).slice(0, 300)}` });
      return;
    }

    const total = exportPayload.resultsObjects.length;
    const prefetchedRows = new Map<string, Record<string, unknown>[]>();
    const ROWS_PAGE_SIZE = 20000;

    for (let i = 0; i < total; i++) {
      const ro = exportPayload.resultsObjects[i];
      const rows: Record<string, unknown>[] = [];
      let offset = 0;
      while (true) {
        const rowsRes = await fetch(
          `https://${sourceServerId}.fastr-analytics.org/export_central/${sourceProjectId}/rows?ro_id=${encodeURIComponent(ro.id)}&offset=${offset}`,
          { headers: { "X-Central-Secret": _CENTRAL_SERVER_SECRET } },
        );
        if (!rowsRes.ok) {
          const text = await rowsRes.text().catch(() => "");
          send({ type: "error", err: `Failed to fetch rows for ${ro.id} (${rowsRes.status}): ${text.slice(0, 200)}` });
          return;
        }
        const rowsJson = await rowsRes.json() as { success: boolean; data?: { rows: Record<string, unknown>[]; hasMore: boolean } };
        if (!rowsJson.success || !rowsJson.data) {
          send({ type: "error", err: `Rows endpoint error for ${ro.id}: ${JSON.stringify(rowsJson).slice(0, 200)}` });
          return;
        }
        rows.push(...rowsJson.data.rows);
        if (!rowsJson.data.hasMore) break;
        offset += ROWS_PAGE_SIZE;
      }
      prefetchedRows.set(ro.id, rows);
      send({ type: "fetching", roId: ro.id, index: i + 1, total, rowsFetched: rows.length });
    }

    send({ type: "importing" });

    const result = await doImport({ ...exportPayload, targetProjectId }, "system");
    if (!result.success) {
      const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");
      await refetchAndNotifyImportHistory(mainDb, targetProjectId);
      send({ type: "error", err: result.err });
      return;
    }

    const projectDb = getPgConnectionFromCacheOrNew(targetProjectId, "READ_AND_WRITE");
    const insertTotal = exportPayload.resultsObjects.length;
    for (let i = 0; i < insertTotal; i++) {
      const ro = exportPayload.resultsObjects[i];
      const tableName = getResultsObjectTableName(ro.id);
      const rows = prefetchedRows.get(ro.id) ?? [];
      await insertRowsChunk(projectDb, tableName, rows, exportPayload.sourceInstanceId);
      send({ type: "inserting", index: i + 1, total: insertTotal });
    }

    const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");
    await refetchAndNotifyMetrics(projectDb, targetProjectId);
    await refetchAndNotifyImportHistory(mainDb, targetProjectId);
    notifyInstanceProjectsLastUpdated();

    send({ type: "done", nResultsObjects: result.data.nResultsObjects, nRowsTotal: result.data.nRowsTotal });
  } catch (err) {
    send({ type: "error", err: err instanceof Error ? err.message : String(err) });
  } finally {
    // Yield to the event loop so the final message is delivered before closing
    await Promise.resolve();
    channel.close();
  }
}
