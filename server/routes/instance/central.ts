import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Sql } from "postgres";
import type { GlobalUser, CentralExportPayload } from "lib";
import { requireHUser } from "../../middleware/auth.ts";
import { copyInsert, doImport, getTableColumns } from "./import.ts";
import { getPgConnectionFromCacheOrNew, getResultsObjectTableName } from "../../db/mod.ts";
import { _BYPASS_AUTH, _CENTRAL_SERVER_SECRET, _SERVERS_FILE_PATH } from "../../exposed_env_vars.ts";
import { notifyInstanceProjectsLastUpdated } from "../../task_management/notify_instance_updated.ts";
import {
  refetchAndNotifyImportHistory,
  refetchAndNotifyMetrics,
} from "../../task_management/refetch_and_notify.ts";

type Env = { Variables: { globalUser: GlobalUser } };

// Heartbeat interval for SSE streams. Proxies/CDNs idle-kill streamed responses
// (Cloudflare at ~100s); a periodic comment keeps them open between real events.
const SSE_KEEPALIVE_MS = 25_000;

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

// Retry a transient operation with exponential backoff. Used for the per-results-
// object row streaming (network/source blips) and per-batch inserts (DB blips) so a
// single hiccup over a long import doesn't fail the whole job.
async function retry<T>(label: string, fn: () => Promise<T>, attempts = 3, baseDelayMs = 1000): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        console.warn(`${label} failed (attempt ${attempt}/${attempts}), retrying in ${delay}ms:`, err);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// Parse an NDJSON row stream, yielding each {"rows":[...]} batch as it arrives.
// A terminal {"done"} ends the stream cleanly; an {"error"} line or a stream that
// closes without a terminal line throws (so the caller's retry kicks in). The reader
// is owned by the caller, which cancels it in a finally — that also unblocks any
// in-flight read here on an error path.
async function* readBatches(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<Record<string, unknown>[]> {
  const decoder = new TextDecoder();
  let buffer = "";
  let terminated = false;
  const parseLine = (line: string): Record<string, unknown>[] | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const msg = JSON.parse(trimmed) as { rows?: Record<string, unknown>[]; done?: boolean; error?: string };
    if (msg.error) throw new Error(`Source rows stream error: ${msg.error}`);
    if (msg.done) {
      terminated = true;
      return null;
    }
    return msg.rows ?? null;
  };

  while (!terminated) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while (!terminated && (nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      const rows = parseLine(line);
      if (rows && rows.length > 0) yield rows;
    }
  }
  // Defensive: a final line that wasn't newline-terminated.
  if (!terminated && buffer.trim()) {
    try {
      const rows = parseLine(buffer);
      if (rows && rows.length > 0) yield rows;
    } catch {
      // fall through to the truncated check below
    }
  }
  if (!terminated) {
    throw new Error("Source rows stream ended without a terminal message (truncated)");
  }
}

// Stream one results object's rows from the source and COPY them in. Returns the
// number of rows inserted.
//
// Idempotent by design: it first clears this source's rows from the table, so a
// retry of the whole call re-imports from scratch instead of duplicating. A
// one-batch look-ahead downloads the next batch while the current one is being
// COPY-inserted, so network and DB time overlap instead of running strictly serially.
async function streamRowsForResultsObject(
  projectDb: Sql,
  tableName: string,
  url: string,
  sourceInstanceId: string,
  onProgress: (rowsInserted: number) => void,
): Promise<number> {
  await projectDb.unsafe(`DELETE FROM ${tableName} WHERE source_server_id = $1`, [sourceInstanceId]);

  const res = await fetch(url, { headers: { "X-Central-Secret": _CENTRAL_SERVER_SECRET } });
  if (!res.ok || !res.body) {
    const text = res.ok ? "empty body" : await res.text().catch(() => "");
    throw new Error(`Failed to fetch rows (${res.status}): ${text.slice(0, 200)}`);
  }

  // COPY targets the table's actual data columns (looked up once); a key missing
  // from a row simply becomes NULL.
  const tableCols = await getTableColumns(projectDb, tableName);
  const allowedColumns = [...tableCols].filter((c) => c !== "source_server_id");

  const reader = res.body.getReader();
  const gen = readBatches(reader);
  let nRows = 0;
  let readMs = 0;
  let insertMs = 0;
  let pending = gen.next();
  pending.catch(() => {}); // mark handled so an error path can't raise an unhandled rejection
  try {
    while (true) {
      const t0 = performance.now();
      const { value, done } = await pending;
      readMs += performance.now() - t0;
      if (done) break;
      pending = gen.next(); // start downloading the next batch while we insert this one
      pending.catch(() => {});
      const t1 = performance.now();
      await retry(
        `COPY batch into ${tableName}`,
        () => copyInsert(projectDb, tableName, allowedColumns, value, sourceInstanceId),
        3,
        500,
      );
      insertMs += performance.now() - t1;
      nRows += value.length;
      onProgress(nRows);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  console.log(`[import] ${tableName}: ${nRows} rows | read(waited) ${Math.round(readMs)}ms | copy ${Math.round(insertMs)}ms`);
  return nRows;
}

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
        // Wait for the next event or a keepalive tick, whichever comes first. The
        // comment line keeps the connection alive through proxies that idle-kill
        // streamed responses (~100s); EventSource ignores lines starting with ":".
        let timer: number | undefined;
        const woke = await new Promise<"msg" | "ping">((r) => {
          resolve = () => r("msg");
          timer = setTimeout(() => r("ping"), SSE_KEEPALIVE_MS);
        });
        resolve = null;
        if (timer !== undefined) clearTimeout(timer);
        if (woke === "ping" && queue.length === 0) {
          await stream.write(": ping\n\n");
        }
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
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");

  const { authHeader, sourceServerId, sourceProjectId, targetProjectId } = job;
  // Defaults used for the history row if we fail before the export payload is read.
  let sourceInstanceId = sourceServerId;
  let sourceInstanceLabel = sourceServerId;
  let historySourceProjectId = sourceProjectId;
  let nResultsObjects = 0;
  let nRowsTotal = 0;

  try {
    const exportResponse = await fetch(
      `https://${sourceServerId}.fastr-analytics.org/export_central/${sourceProjectId}`,
      { headers: { Authorization: authHeader } },
    );
    if (!exportResponse.ok) {
      const text = await exportResponse.text();
      throw new Error(`Export failed (${exportResponse.status}): ${text.slice(0, 200)}`);
    }
    const exportJson = await exportResponse.json();
    const exportPayload: CentralExportPayload = exportJson.data ?? exportJson;
    if (!exportPayload || !Array.isArray(exportPayload.modules)) {
      throw new Error(`Unexpected export response from ${sourceServerId}: ${JSON.stringify(exportPayload).slice(0, 300)}`);
    }
    sourceInstanceId = exportPayload.sourceInstanceId;
    sourceInstanceLabel = exportPayload.sourceInstanceLabel;
    historySourceProjectId = exportPayload.sourceProjectId;

    const total = exportPayload.resultsObjects.length;

    // Set up schema/modules/metrics first. The row payload embedded in
    // exportPayload is empty on this path (rows are streamed separately below),
    // so this creates the tables and clears prior data for this source without
    // materialising any rows in memory. History is recorded here only after the
    // rows actually land, so doImport must not write a premature success row.
    send({ type: "importing" });

    const result = await doImport({ ...exportPayload, targetProjectId }, "system", { recordHistory: false });
    if (!result.success) throw new Error(result.err);
    nResultsObjects = result.data.nResultsObjects;

    const projectDb = getPgConnectionFromCacheOrNew(targetProjectId, "READ_AND_WRITE");

    // Stream each results object: one streaming request that yields NDJSON row
    // batches, inserted as they arrive (memory stays bounded to one batch). Each
    // results object is retried independently and re-clears its rows on every
    // attempt, so a transient blip over a long import can't fail the whole job or
    // duplicate data.
    for (let i = 0; i < total; i++) {
      const ro = exportPayload.resultsObjects[i];
      const tableName = getResultsObjectTableName(ro.id);
      const url = `https://${sourceServerId}.fastr-analytics.org/export_central/${sourceProjectId}/rows?ro_id=${encodeURIComponent(ro.id)}`;
      const roRows = await retry(
        `fetch rows for ${ro.id}`,
        () => streamRowsForResultsObject(projectDb, tableName, url, sourceInstanceId, (rowsFetched) => {
          send({ type: "fetching", roId: ro.id, index: i + 1, total, rowsFetched });
        }),
      );
      nRowsTotal += roRows;
      send({ type: "inserting", index: i + 1, total });
    }

    // Record success only now that every row has actually landed.
    await mainDb`
      INSERT INTO import_history (
        source_server_id, source_server_label, source_project_id,
        target_project_id, imported_by, n_results_objects, n_rows_total, status
      ) VALUES (
        ${sourceInstanceId}, ${sourceInstanceLabel}, ${historySourceProjectId},
        ${targetProjectId}, 'system', ${nResultsObjects}, ${nRowsTotal}, 'success'
      )
    `;

    await refetchAndNotifyMetrics(projectDb, targetProjectId);
    await refetchAndNotifyImportHistory(mainDb, targetProjectId);
    notifyInstanceProjectsLastUpdated();

    send({ type: "done", nResultsObjects, nRowsTotal });
  } catch (err) {
    // The import genuinely failed — record it as such so the history panel never
    // shows a success the data doesn't back up.
    await mainDb`
      INSERT INTO import_history (
        source_server_id, source_server_label, source_project_id,
        target_project_id, imported_by, n_results_objects, n_rows_total, status
      ) VALUES (
        ${sourceInstanceId}, ${sourceInstanceLabel}, ${historySourceProjectId},
        ${targetProjectId}, 'system', ${nResultsObjects}, ${nRowsTotal}, 'failed'
      )
    `.catch(() => {});
    await refetchAndNotifyImportHistory(mainDb, targetProjectId).catch(() => {});
    send({ type: "error", err: err instanceof Error ? err.message : String(err) });
  } finally {
    // Yield to the event loop so the final message is delivered before closing
    await Promise.resolve();
    channel.close();
  }
}
