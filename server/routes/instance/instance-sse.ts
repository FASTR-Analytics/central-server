import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { GlobalUser, InstanceSseMessage, InstanceState } from "lib";
import { requireAuth } from "../../middleware/auth.ts";
import { INSTANCE_UPDATES_CHANNEL } from "../../task_management/notify_instance_updated.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export const routesInstanceSSE = new Hono<Env>();

/**
 * Instance SSE endpoint.
 *
 * Same subscribe-before-build ordering as the project endpoint: messages
 * broadcast while the `starting` snapshot is being assembled are queued and
 * drained after it is sent.
 */
routesInstanceSSE.get("/instance_updates", requireAuth(), (c) => {
  const globalUser = c.get("globalUser");

  return streamSSE(c, async (stream) => {
    // Step 1: Subscribe BEFORE building state (prevents race condition)
    const messageQueue: InstanceSseMessage[] = [];
    let notifyNewMessage: (() => void) | null = null;

    const broadcastReceiver = new BroadcastChannel(INSTANCE_UPDATES_CHANNEL);

    const messageHandler = (evt: MessageEvent<InstanceSseMessage>) => {
      messageQueue.push(evt.data);
      notifyNewMessage?.();
    };

    broadcastReceiver.addEventListener("message", messageHandler);

    try {
      // Step 2+3: Build and send starting message
      const now = new Date().toISOString();
      const startingState: InstanceState = {
        isReady: true,
        currentUserEmail: globalUser.email,
        projectsLastUpdated: now,
        usersLastUpdated: now,
      };
      const startingMessage: InstanceSseMessage = {
        type: "starting",
        data: startingState,
      };
      await stream.writeSSE({ data: JSON.stringify(startingMessage) });

      // Step 4+5: Drain queue and forward subsequent messages
      while (true) {
        while (messageQueue.length > 0) {
          const queued = messageQueue.shift()!;
          await stream.writeSSE({ data: JSON.stringify(queued) });
        }
        await new Promise<void>((resolve) => {
          notifyNewMessage = resolve;
        });
        notifyNewMessage = null;
      }
    } finally {
      broadcastReceiver.removeEventListener("message", messageHandler);
      broadcastReceiver.close();
    }
  });
});
