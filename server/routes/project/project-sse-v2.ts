import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { GlobalUser, ProjectSseMessage } from "lib";
import { getPgConnectionFromCacheOrNew } from "../../db/mod.ts";
import { requireAuth } from "../../middleware/auth.ts";
import { buildProjectState } from "../../task_management/build_project_state.ts";
import { PROJECT_UPDATES_CHANNEL } from "../../task_management/notify_project_v2.ts";

type Env = { Variables: { globalUser: GlobalUser } };

// Heartbeat interval for SSE streams; keeps connections alive through proxies that
// idle-kill streamed responses (Cloudflare at ~100s).
const SSE_KEEPALIVE_MS = 25_000;

export const routesProjectSSEV2 = new Hono<Env>();

type QueuedMessage = ProjectSseMessage & { projectId: string };

/**
 * V2 Project SSE endpoint.
 *
 * Key point: subscribe-before-build ordering prevents the race condition
 * where messages broadcast during buildProjectState() are dropped.
 *
 * Order:
 * 1. Subscribe to BroadcastChannel (queue messages)
 * 2. Build full ProjectState from DB
 * 3. Send `starting` with full state
 * 4. Drain queued messages
 * 5. Forward subsequent messages
 */
routesProjectSSEV2.get("/project_sse_v2/:projectId", requireAuth(), (c) => {
  const projectId = c.req.param("projectId");
  const globalUser = c.get("globalUser");

  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");
  const projectDb = getPgConnectionFromCacheOrNew(projectId, "READ_ONLY");

  return streamSSE(c, async (stream) => {
    // Step 1: Subscribe BEFORE building state (prevents race condition)
    const messageQueue: QueuedMessage[] = [];
    let notifyNewMessage: (() => void) | null = null;

    const broadcastReceiver = new BroadcastChannel(PROJECT_UPDATES_CHANNEL);

    const messageHandler = (evt: MessageEvent<QueuedMessage>) => {
      if (evt.data.projectId !== projectId) return;
      messageQueue.push(evt.data);
      notifyNewMessage?.();
    };

    broadcastReceiver.addEventListener("message", messageHandler);

    try {
      // Step 2: Build full ProjectState
      const result = await buildProjectState(mainDb, projectDb, projectId, globalUser);

      if (!result.success) {
        const errorMessage: ProjectSseMessage = {
          type: "error",
          data: { message: result.err },
        };
        await stream.writeSSE({ data: JSON.stringify(errorMessage) });
        return;
      }

      // Step 3: Send starting message with full state
      const startingMessage: ProjectSseMessage = {
        type: "starting",
        data: result.data,
      };
      await stream.writeSSE({ data: JSON.stringify(startingMessage) });

      // Step 4+5: Drain queue and forward subsequent messages
      while (true) {
        while (messageQueue.length > 0) {
          const queued = messageQueue.shift()!;
          const { projectId: _pid, ...message } = queued;
          await stream.writeSSE({ data: JSON.stringify(message) });
        }
        // Wait for the next message or a keepalive tick. The comment line keeps the
        // connection alive through proxies that idle-kill streamed responses
        // (~100s); EventSource ignores lines starting with ":".
        let timer: number | undefined;
        const woke = await new Promise<"msg" | "ping">((resolve) => {
          notifyNewMessage = () => resolve("msg");
          timer = setTimeout(() => resolve("ping"), SSE_KEEPALIVE_MS);
        });
        notifyNewMessage = null;
        if (timer !== undefined) clearTimeout(timer);
        if (woke === "ping" && messageQueue.length === 0) {
          await stream.write(": ping\n\n");
        }
      }
    } finally {
      broadcastReceiver.removeEventListener("message", messageHandler);
      broadcastReceiver.close();
    }
  });
});
