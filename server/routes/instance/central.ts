import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Readable } from "node:stream";
import type { Sql } from "postgres";
import type { GlobalUser, CentralExportPayload } from "lib";
import { requireHUser } from "../../middleware/auth.ts";
import { doImport, getTableColumns } from "./import.ts";
import { createWorkerWriteConnection, getPgConnectionFromCacheOrNew, getResultsObjectTableName } from "../../db/mod.ts";
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

// Stream one results object from the source straight into Postgres. The source emits raw
// COPY TEXT (`COPY (SELECT …) TO STDOUT`) for exactly the columns this table keeps, and we
// pipe those bytes directly into `COPY … FROM STDIN` — no per-row JS and no (de)compression
// on either side, so the whole object is one continuous COPY that runs near DB/network
// speed. Idempotent: it first clears this source's rows, so a retry re-imports cleanly.
// `db` must be a dedicated no-statement-timeout connection — a single COPY streams for minutes.
async function streamRowsForResultsObject(
  db: Sql,
  tableName: string,
  sourceServerId: string,
  sourceProjectId: string,
  roId: string,
  sourceInstanceId: string,
): Promise<number> {
  await db.unsafe(`DELETE FROM ${tableName} WHERE source_server_id = $1`, [sourceInstanceId]);

  // The table carries only the columns kept at import (redundant period columns dropped).
  // Ask the source for exactly those, in this order; source_server_id is prepended by the source.
  const tableCols = await getTableColumns(db, tableName);
  const dataColumns = [...tableCols].filter((c) => c !== "source_server_id");

  const url = `https://${sourceServerId}.fastr-analytics.org/export_central/${sourceProjectId}/rows`
    + `?ro_id=${encodeURIComponent(roId)}&cols=${encodeURIComponent(dataColumns.join(","))}`;
  // Accept-Encoding: identity → the source streams uncompressed COPY TEXT and we skip gunzip
  // (sources are co-located at ~70 MB/s, and Deno's auto-gunzip is thread-pool-contended).
  const res = await fetch(url, {
    headers: { "X-Central-Secret": _CENTRAL_SERVER_SECRET, "Accept-Encoding": "identity" },
  });
  if (!res.ok || !res.body) {
    const text = res.ok ? "no body" : await res.text().catch(() => "");
    throw new Error(`Failed to fetch rows (${res.status}): ${text.slice(0, 200)}`);
  }

  const cols = ["source_server_id", ...dataColumns];
  const startedAt = performance.now();
  const writable = await db`COPY ${db(tableName)} (${db(cols)}) FROM STDIN`.writable();
  await new Promise<void>((resolve, reject) => {
    // Pipe the response body (raw COPY bytes) into the COPY stream with backpressure.
    const src = Readable.fromWeb(res.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
    // A source/network error must destroy the COPY so it rolls back (atomic — no partial rows)
    // and the connection is freed; the caller's retry then re-clears and re-imports cleanly.
    src.on("error", (e) => { writable.destroy(e as Error); reject(e); });
    writable.on("error", reject);
    writable.on("finish", () => resolve());
    src.pipe(writable);
  });

  const [{ count }] = await db.unsafe(
    `SELECT count(*)::int AS count FROM ${tableName} WHERE source_server_id = $1`,
    [sourceInstanceId],
  ) as { count: number }[];
  console.log(`[import] ${tableName}: ${count} rows in ${Math.round(performance.now() - startedAt)}ms`);
  return count;
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

    // Stream each results object straight into Postgres via COPY-passthrough: the source
    // emits raw COPY TEXT and we pipe it into COPY FROM STDIN (no per-row JS either side).
    // Each object is retried independently and re-clears its rows on every attempt, so a
    // transient blip can't fail the whole job or duplicate data. A dedicated, no-statement-
    // timeout connection carries the long-running COPYs.
    const importDb = createWorkerWriteConnection(targetProjectId);
    try {
      for (let i = 0; i < total; i++) {
        const ro = exportPayload.resultsObjects[i];
        const tableName = getResultsObjectTableName(ro.id);
        send({ type: "fetching", roId: ro.id, index: i + 1, total, rowsFetched: 0 });
        const roRows = await retry(
          `stream rows for ${ro.id}`,
          () => streamRowsForResultsObject(importDb, tableName, sourceServerId, sourceProjectId, ro.id, sourceInstanceId),
        );
        nRowsTotal += roRows;
        send({ type: "inserting", index: i + 1, total });
      }
    } finally {
      await importDb.end().catch(() => {});
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
