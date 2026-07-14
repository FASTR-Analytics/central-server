# Central Import/Export Performance Fix

**Outcome:** importing a country's data into the central reporting server went from **~14 hours
(~4–5k rows/s)** to **minutes (~100–200k rows/s)** — a ~30–40× speedup. Verified end-to-end:
Haiti imported at ~160–200k rows/s; afghanistan (≈3× the data) now completes without crashing.

This documents the root causes, the fix that shipped, and — importantly — the measurements that
got us there, including the several hypotheses we **ruled out** before landing on the real cause.

---

## 1. The problem

A "central reporting" server imports each country's results-object tables (e.g. Nigeria,
~280M rows) by pulling them over HTTPS from the country/platform servers. The pipeline was:

- **Source** (`platform`, `export_central.ts` `/rows`): server-side cursor → `JSON.stringify`
  each 20k-row batch → gzip (`CompressionStream`) → NDJSON over HTTP.
- **Central** (`central-server`, `central.ts`): read NDJSON → `JSON.parse` → `encodeCopyValue`
  → one Postgres `COPY` per batch.

It ran at ~4–5k rows/s regardless of country or time of day. We had guessed wrong about the
cause before, so the rule for this work was **measure, don't guess.**

---

## 2. Root causes (there were three layers)

Each was found by measurement and is addressed by the final design:

1. **Source gzip on Deno's contended thread pool.** `CompressionStream("gzip")` offloads to a
   blocking thread pool that the long-running app keeps busy, throttling the export **~12×**
   (measured: `identity` 67k rows/s vs `gzip` 5.7k/s on the *same* idle instance). It also
   silently defaulted to level ~6.
2. **Central gunzip, same thread-pool contention.** Deno's `fetch` auto-decompresses
   `Content-Encoding: gzip` on the same kind of contended pool, inflating central's COPY time
   (m3: 218s with gzip vs 12s without).
3. **Per-row JS on two single event loops + batched consumption.** Even uncompressed, the
   batched read→parse→encode→COPY loop runs per-row JavaScript on the *single* Deno event loop
   of **both** servers, and pausing each batch to process stalls the demand-driven HTTP stream.
   A continuous drain does ~70 MB/s; the batched cycle collapsed to ~5k/s.

Everything else was **fast in isolation** and was ruled out (see tests below): the central
database, the disk/volume, the network/proxy, the Postgres cursor, and JSON encoding CPU.

---

## 3. The fix that shipped — continuous COPY pipe (no per-row JS on central)

Lockstep change across both repos; the wire is now raw Postgres **COPY TEXT** (uncompressed —
the link is ~70 MB/s, so compression isn't needed and avoids the thread-pool issue entirely):

```
SOURCE (platform)                              CENTRAL (central-server)
ro_<table>  --cursor(20k)-->  format COPY TEXT  --HTTP-->  COPY <table> FROM STDIN
            (pull-based ReadableStream:                    (res.body piped straight in;
             advances only when consumer reads             zero per-row JS; COPY-speed)
             → bounded memory)
```

**Platform — `server/routes/instance/export_central.ts`** (`/export_central/:project_id/rows`)
- Reads the requested columns (`?cols=`, validated against the table; missing → `\N` to keep
  column order), via a **server-side cursor** (batch 20k) on a dedicated no-statement-timeout
  connection.
- Formats Postgres **COPY TEXT** per batch (instance id as `source_server_id`, backslash/tab/
  newline-escaped) and emits it through a **pull-based `ReadableStream`** so the cursor only
  advances when central reads → **memory bounded to one batch regardless of table size.**
- No gzip, no `JSON.stringify`.

**Central — `server/routes/instance/central.ts`** (`streamRowsForResultsObject`)
- Computes its kept columns, requests exactly those, `fetch`es with `Accept-Encoding: identity`,
  and pipes `res.body` **straight into `COPY <table> (source_server_id, …) FROM STDIN`**
  (`Readable.fromWeb(...).pipe(writable)`). **Zero per-row JS on central**; Postgres ingests at
  COPY speed. A source/network error destroys the COPY (atomic rollback) so the retry re-imports.
- Per-results-object `DELETE`-then-COPY idempotency and RO-level retry are kept.

**Central — `server/db/postgres/connection_manager.ts`**
- New `createWorkerWriteConnection` (no `statement_timeout`, `prepare:false`); `runImportJob`
  opens one per import for the long single COPYs. The shared pool's 5-min `statement_timeout`
  would kill a multi-minute COPY.

### Key gotcha (cost us two source OOM crashes)
`postgres.js`'s COPY-`TO-STDOUT` `.readable()` — and `Readable.toWeb` over it — **do not honor
consumer backpressure**: they drain the whole result into the source heap and OOM on large
tables. The memory-safe pattern is a **`.cursor()` driven by a pull-based `ReadableStream`**
(advances only on read). General rule: to stream large Postgres data out with bounded memory,
use a cursor, not COPY `.readable()`.

### Trade-offs (accepted)
- **Lockstep deploy:** the `/rows` contract changed (NDJSON → raw COPY + `cols`), no fallback —
  deploy the platform image to all country servers **and** central together.
- **Progress is per-results-object**, not per-batch (the byte stream is opaque).

---

## 4. Tests & measurements conducted

### Production / on-box measurements (the diagnosis)
| # | Test | Result | Conclusion |
|---|------|--------|-----------|
| 1 | Local CPU micro-benchmark (real row shape): `JSON.stringify`, `JSON.parse`, `encodeCopyValue`, gzip levels | stringify 526 ns/row, parse 739, encode 2770, `CompressionStream`≈L6 3186, `node:zlib` L1 362 | Found CompressionStream silently uses ~L6; encode is regex-heavy |
| 2 | Production `[import]` logs (old pipeline) | `copy` ~239 µs/row dominated; `read(waited)` tiny | Refuted "JSON/CPU is the bottleneck"; pointed downstream |
| 3 | Central Postgres: `INSERT`, server-side `COPY FROM file`, sustained 24M-row write | 500k–1.56M rows/s; COPY 648k/s; **flat 470k/s, no burst throttle** | Central DB and its volume are **fast** — not the bottleneck |
| 4 | App COPY path via `postgres.js .writable()` — per-batch vs single | 245k / 605k rows/s | The COPY mechanism is fast |
| 5 | Full app pipeline at scale (20M rows: parse+encode+COPY) | ~93k rows/s, flat memory, no decay | Central app path is fine at scale |
| 6 | Fetch the rows from the source (real path) | **~4.5k rows/s = matches production** | Bottleneck is the **source export**, not central |
| 7 | Source DB read (`COPY (…) TO '/dev/null'`); cursor; cursor+stringify; `COPY TO STDOUT` | 897k / 350k / 281k / 714k rows/s | Source DB + cursor are fast — not the cause |
| 8 | Source stream+gzip consumed locally; standalone `Deno.serve` over HTTP | 147k / 120k rows/s | Stream plumbing & Deno HTTP are fine in isolation |
| 9 | Source idle vs serving (`docker stats`); afghanistan 0%→130% but still ~5k/s | slow even when idle | Not server load |
| 10 | **gzip on/off bisection** (`Accept-Encoding: identity` vs `gzip`), same endpoint/instant | **identity 67k/s vs gzip 5.7k/s (~12×)** | **`CompressionStream` (thread-pool) is the source bottleneck** |
| 11 | After source `node:zlib` fix: central split-timer + `identity` | central `copy` 218s → **12s**; but `read(waited)` 262s | Central gunzip was inflating `copy`; consumption became the wall |
| 12 | Pure read of the source (no parse/copy), steady-state | **~70 MB/s** | Transfer is fast — the ~5k/s was batched per-row processing on single event loops |

### Verification of the implementation (local, before each deploy)
| Test | Result |
|------|--------|
| `deno check main.ts` — both repos | Pass |
| Node↔Web stream bridge round-trip (`toWeb`→`fetch`→`fromWeb`→pipe) | Byte-exact (4.9 MB / 200k lines) |
| Multi-member gzip decoded by Deno `fetch` (intermediate gzip fix) | OK |
| **Backpressure stall test**: stop reading for 2s, watch the cursor | Plateaus at ~13 batches (unbounded would be ~2000) — memory bounded |

### End-to-end (production, after deploy)
- **Haiti:** imported via the passthrough at **~160–200k rows/s** (e.g. m3 1.43M rows in ~7s).
- **afghanistan:** first attempts OOM'd the source (the COPY `.readable()` buffering gotcha);
  after switching the source to the cursor+pull stream, it **completes without crashing**.

---

## 5. Optional follow-ups (not in this change)
- **Partition `ro_` tables by `source_server_id` + `TRUNCATE`** instead of the pre-COPY
  `DELETE`: re-imports of large tables currently pay a full unindexed `DELETE` (seq scan +
  bloat); first imports don't. Pure re-import hygiene.
- The constant `PO Items` cache-miss query storm seen on the country apps is a separate,
  app-wide performance issue (Valkey caching / PO query perf) worth its own look.
- `node:zlib` gzip on the wire only if central is ever moved to a bandwidth-limited host
  (co-located today at ~70 MB/s, so uncompressed is simplest).
