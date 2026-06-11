# SSE & Real-Time Notifications

The server-side push system: in-process `BroadcastChannel` fan-out to two Server-Sent-Events streams (instance + project), the subscribe-before-build connection lifecycle, and the typed `notify*` wrapper catalog (this doc owns it).

> This system is ported from the platform repo (`~/Work/platform/DOC_SSE_REALTIME.md`) with deliberate simplifications — see "Differences from the platform" below. There is also a third, **separate** SSE stream: the per-job import-progress stream (`GET /import_progress/:jobId`, channel `import:<jobId>` in `routes/instance/central.ts`). That one is request-scoped and job-scoped; it is not part of the notify catalog and predates this system. Leave it alone.

---

## Principles

1. **Mutations don't return fresh state — they broadcast it.** A route mutates, then `notify*()`s; clients install state from the SSE feed. Clients never poll and never refetch off a mutation response.
2. **One typed `notify*` wrapper per event type.** Call sites never build a raw SSE message — they call a named wrapper that owns the `{ type, data }` shape.
3. **Subscribe before you build.** SSE endpoints subscribe to the channel *first*, then build the initial snapshot, then drain anything that arrived during the build. Nothing broadcast during the build is lost.
4. **Broadcast whole lists, not deltas.** Every event carries the complete fresh list; the client installs it with `reconcile()`. Per-user-filtered lists (projects, instance users) are the exception — they broadcast a *version token* and each client refetches through the permission-enforcing REST endpoint.

---

## The System

```text
  Route handler (after a successful DB write)
    │  await refetchAndNotifyVisualizations(projectDb, projectId)
    ▼
  refetch helper → getAllX() → notify* wrapper
    │                            → broadcastChannel.postMessage({ type, data [, projectId] })
    ▼
  SSE endpoint listener → filters by projectId (project channel) → stream.writeSSE(JSON)
    │                      (projectId stripped from the wire message)
    ▼
  Client EventSource (t1_sse.tsx) → applyProjectSseMessage() → reconcile() into store → UI reacts
```

There are exactly **two** broadcast channels for this system, each with one SSE endpoint. The channel-name strings are exported constants from the notify files and imported by the endpoints — never retype them.

| Channel constant | Endpoint | File | Guard |
|------------------|----------|------|-------|
| `INSTANCE_UPDATES_CHANNEL` (`"instance_updates"`) | `GET /instance_updates` | `routes/instance/instance-sse.ts` | `requireAuth()` |
| `PROJECT_UPDATES_CHANNEL` (`"project_updates_v2"`) | `GET /project_sse_v2/:projectId` | `routes/project/project-sse-v2.ts` | `requireAuth()` |

Auth is Clerk **cookie** auth: `EventSource` cannot set headers, so the client connects with `{ withCredentials: true }` and the Clerk middleware reads the session cookie. (`BroadcastChannel` requires the `--unstable-broadcast-channel` flag, already set in the deno.json tasks; it is **in-process** — fine for the single `Deno.serve`, but horizontal scaling would silently partition events.)

### The message contract (discriminated unions)

`lib/types_sse.ts` holds both unions (`ProjectSseMessage`, `InstanceSseMessage`) and both snapshot types (`ProjectState`, `InstanceState`). The first message on any connection is always `{ type: "starting", data: <full state> }`; `{ type: "error", data: { message } }` terminates with an error. Project messages carry an extra `projectId` on the wire so the endpoint can filter to its project; it is stripped before forwarding, so the client-side type never sees it.

**Project events** (whole-list payloads): `project_config_updated` (label + isLocked), `metrics_updated`, `visualizations_updated`, `visualization_folders_updated`, `slide_decks_updated`, `slide_deck_folders_updated`, `project_users_updated`, `import_history_updated`.

**Instance events** (version tokens — see Principle 4): `projects_last_updated`, `users_last_updated`. Token events carry only a timestamp string; the client watches it and `silentFetch()`es `GET /projects` / `GET /users`, which apply per-user filtering server-side.

### Connection lifecycle — subscribe-before-build

Both endpoints use Hono's `streamSSE` and the same mechanism (a `messageQueue` + `notifyNewMessage` promise loop):

```text
1. Subscribe to the BroadcastChannel  ← FIRST, so nothing is missed during build
2. Build the initial state (buildProjectState / trivial InstanceState stamp)
3. writeSSE({ type: "starting", data: state })
4. Drain messages queued during step 2
5. Forward all subsequent messages until the connection closes
   (listener removal + channel.close() in finally)
```

`server/task_management/build_project_state.ts` assembles the project snapshot: project row + per-connection permissions (`getProjectPermissions`), then `importHistory` only if `can_view_data`/`can_configure_data` and `projectUsers` only if `can_configure_users` — the same gating as `GET /projects/:id` — plus the five project lists (metrics via `db/project/metrics.ts`, presentation objects, both folder types, slide decks).

### The notify catalog (producer side)

**This doc is the normative owner of the notify layer.** Every broadcast goes through a typed wrapper — never call `postMessage` directly.

`server/task_management/notify_project_v2.ts` — `notifyProjectV2(projectId, message)` spreads `projectId` in and posts to the project channel. Wrappers: `notifyProjectConfigUpdated`, `notifyProjectMetricsUpdated`, `notifyProjectVisualizationsUpdated`, `notifyProjectVisualizationFoldersUpdated`, `notifyProjectSlideDecksUpdated`, `notifyProjectSlideDeckFoldersUpdated`, `notifyProjectUsersUpdated`, `notifyProjectImportHistoryUpdated`.

`server/task_management/notify_instance_updated.ts` — `notifyInstanceUpdate(message)` posts to the instance channel. Wrappers: `notifyInstanceProjectsLastUpdated`, `notifyInstanceUsersLastUpdated` (both default to `new Date().toISOString()`).

`server/task_management/refetch_and_notify.ts` — the refetch+notify combos routes actually call: `refetchAndNotifyVisualizations`, `refetchAndNotifyVisualizationFolders`, `refetchAndNotifySlideDecks`, `refetchAndNotifySlideDeckFolders`, `refetchAndNotifyMetrics`, `refetchAndNotifyProjectUsers`, `refetchAndNotifyImportHistory`. Each refetches the list and broadcasts it; a failed refetch is `console.error`ed, **never silent** (a silent failure strands every connected client on stale state).

### The mutation recipe

```ts
const result = await createSlideDeck(projectDb, body.label, body.folderId);
if (!result.success) return c.json(result, 500);
await refetchAndNotifySlideDecks(projectDb, projectId);
return c.json(result);   // success/err (+ created id) — never fresh lists
```

Notes on coverage:
- **Slide mutations notify decks.** Every slide create/update/delete/duplicate/move fires `refetchAndNotifySlideDecks` — the deck list's ordering (`last_updated DESC`), `firstSlideId`, and thumbnails all derive from slides.
- **Folder deletes fire two events** (`…Folders` + the owning list) because `ON DELETE SET NULL` moves items to General.
- **Project label/lock fires two scopes**: `notifyProjectConfigUpdated` (open-project header/lock card) + `notifyInstanceProjectsLastUpdated` (projects grid).
- **Import completion** (both `runImportJob` in `routes/instance/central.ts` and `POST /import_result_objects` in `routes/instance/import.ts`) fires `refetchAndNotifyMetrics` + `refetchAndNotifyImportHistory` + `notifyInstanceProjectsLastUpdated` — only *after* the row-insert loop, just before the per-job `done` event, so clients don't refetch metrics mid-insert.

### Client side (consumer)

| File | Purpose |
|------|---------|
| `client/src/state/project/t1_store.ts` | `projectState` store; `applyProjectSseMessage()` switch using `reconcile()`; `resetProjectState()` |
| `client/src/state/project/t1_sse.tsx` | `connectProjectSSE`/`disconnectProjectSSE`, retry w/ backoff (max 3 attempts), `ProjectSSEBoundary` |
| `client/src/state/instance/t1_store.ts` | `instanceState` (the two version tokens + isReady) |
| `client/src/state/instance/t1_sse.tsx` | instance connection (max 5 attempts), `InstanceSSEBoundary` |

- `InstanceSSEBoundary` wraps `CentralMain` (`routes/index.tsx`); `ProjectSSEBoundary` wraps `ProjectDetail`'s content. Each boundary connects on mount, disconnects (and **resets its store**) on cleanup, gates children on `isReady`, and shows a failure fallback after max retries.
- List components (`VisualizationsList`, `SlideDecksList`, `ProjectDetail`, `VisualizationEditor`, `select_visualization_for_slide`) read `projectState` directly — no list `timQuery`s, no post-mutation `silentFetch`. Per-item fetches (chart previews, slide thumbnails, PO detail) remain query-based.
- Token consumers keep their `timQuery` and add a deferred watcher:
  ```ts
  createEffect(on(() => instanceState.projectsLastUpdated, () => void projectsQuery.silentFetch(), { defer: true }));
  ```
- `project_users_updated` also recomputes `thisUserPermissions` from `currentUserEmail` (skipped if the user isn't in the list — global admins have no role row).
- `reconcile()` keys by `id` by default; `projectUsers` is keyed by `email` (`reconcile(data, { key: "email" })`).

### Differences from the platform

Central deliberately omits platform machinery it has no use for:

| Platform | Central |
|----------|---------|
| `notifyLastUpdated` row-level version events → Valkey cache keys | **None** — no Valkey cache, no per-row version tracking |
| Module dirty-state / `any_running` / `r_script` events | **None** — no module runner |
| Instance `starting` carries full instance detail; `users_updated` carries data | Instance `starting` is just tokens + identity; users/projects are token events (lists are per-user filtered) |
| Project SSE soft-auth (`getProjectUserForSSE`, optional user) | `requireAuth()` like every other central route |
| Channel-name strings duplicated producer/consumer (documented gotcha) | Exported constants (`PROJECT_UPDATES_CHANNEL`, `INSTANCE_UPDATES_CHANNEL`) |
| Failed post-write refetch is silent (documented gotcha) | `refetch_and_notify.ts` always `console.error`s |

The `_v2` suffix on the project route/channel is inherited platform naming (there is no v1 anywhere in central) — kept so the two codebases stay greppable against each other.

---

## Rules

1. **After a successful mutation, notify — never return fresh lists for the client to install.** Call the matching `refetchAndNotify*` helper; the mutation response is `success`/`err` (+ created ids).
2. **Use a typed wrapper.** A new event type means: union member in `lib/types_sse.ts` + `notify<Thing>Updated` wrapper + (usually) a `refetchAndNotify<Thing>` helper — never `postMessage` a raw object.
3. **Subscribe before building** in any new SSE endpoint, and remove the listener + `close()` the `BroadcastChannel` in a `finally`.
4. **Per-user-filtered data gets a token event, not a data event.** If different users would legitimately see different versions of a list, broadcast a token and let each client refetch through the permission-enforcing endpoint.
5. **Components inside a boundary read the store.** No new list `timQuery` for data that `ProjectState` already carries; no `silentFetch` driven by mutation success.

---

## What NOT to do

- **Don't build SSE messages inline.** A raw `{ type, data }` at a call site bypasses the catalog and drifts from the union type.
- **Don't return updated data in the mutation response expecting the client to use it.** The client installs state from SSE.
- **Don't retype the channel-name strings.** Import the constants from the notify files.
- **Don't notify from GET routes.** Reads never broadcast.
- **Don't put per-user-gated data in a broadcast event.** Broadcasts reach every connected client of that project regardless of their permissions (see Gotchas) — the per-connection `starting` snapshot is the only permission-gated payload.

---

## Gotchas

- **Broadcast visibility is wider than REST visibility.** Any approved user connected to a project's stream receives `project_users_updated` and `import_history_updated` payloads even where `GET /projects/:id` would have hidden them (only the `starting` snapshot applies the `can_configure_users` / `can_view_data` gating). This matches the laxness of central's existing requireAuth-only project routes — but it's why Rule 4 exists for anything more sensitive.
- **Removed-user staleness.** If the current user's role row is deleted, `project_users_updated` finds no match and `thisUserPermissions` stays stale until reconnect (platform behaves the same).
- **`BroadcastChannel` is in-process.** A second Deno instance would have its own channels: mutations on instance A would never reach clients connected to instance B. Single-process deployments only, or replace the transport.
- **Slide editing is chatty.** Every slide save broadcasts the full `slide_decks_updated` list. `reconcile()` keeps unchanged decks referentially stable so thumbnails shouldn't re-render, but watch `SlideDeckThumbnail`'s `createEffect` (it reads `deck.firstSlideId`/`deck.config`) if save-spam ever causes refetch storms.
- **Long-lived streams vs proxies and connection limits.** The instance + project streams live for the whole session (unlike the short import-progress stream). A proxy that buffers or kills idle connections will exhaust the client's retry budget (3–5 attempts) and show the failure fallback. Over HTTP/1.1 a browser allows ~6 connections per origin and one tab now holds 2–3 — multiple dev tabs can starve; HTTP/2 in production avoids this.
- **A `starting` build failure ends the stream.** `buildProjectState` failing sends one `error` event and returns; the client's retry/backoff (not the endpoint) is responsible for recovery.

---

## Adding a real-time-updated entity — checklist

- [ ] Add the entity to `ProjectState` and a `{ type, data }` union member to `ProjectSseMessage` in `lib/types_sse.ts` (or token event in `InstanceSseMessage` if per-user filtered)
- [ ] Add a `notify<Thing>Updated` wrapper in `notify_project_v2.ts` / `notify_instance_updated.ts`
- [ ] Add a `refetchAndNotify<Thing>` helper in `refetch_and_notify.ts` (refetch → notify → `console.error` on failure)
- [ ] Include the entity in `build_project_state.ts` so a fresh connection sees it
- [ ] Call the helper from every mutating route for that entity (remember cascades: folder deletes touch the owning list too)
- [ ] Handle the new `type` in `applyProjectSseMessage` (`t1_store.ts`) — mind the `reconcile` key if rows aren't keyed by `id`
- [ ] Components read the new field from `projectState`; no new list query, no post-mutation refetch

---

## Key files

| File | Purpose |
|------|---------|
| `server/routes/instance/instance-sse.ts` | `GET /instance_updates` SSE endpoint |
| `server/routes/project/project-sse-v2.ts` | `GET /project_sse_v2/:projectId` SSE endpoint |
| `server/task_management/notify_project_v2.ts` | project notify catalog + channel constant |
| `server/task_management/notify_instance_updated.ts` | instance notify catalog + channel constant |
| `server/task_management/refetch_and_notify.ts` | refetch+broadcast helpers routes call |
| `server/task_management/build_project_state.ts` | project `starting` snapshot (per-connection permission gating) |
| `server/db/project/metrics.ts` | `getProjectMetrics` (shared by REST route, snapshot, import notify) |
| `lib/types_sse.ts` | `ProjectState`/`InstanceState` + both message unions |
| `client/src/state/project/{t1_store.ts,t1_sse.tsx}` | project store + connection + `ProjectSSEBoundary` |
| `client/src/state/instance/{t1_store.ts,t1_sse.tsx}` | instance tokens + connection + `InstanceSSEBoundary` |
| `server/routes/instance/central.ts` | the separate per-job import-progress SSE (`import:<jobId>`) |
