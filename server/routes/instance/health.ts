import { Hono } from "hono";
import { _INSTANCE_NAME, _SERVER_VERSION, _START_TIME } from "../../exposed_env_vars.ts";
import { getGlobalUser } from "../../auth.ts";

export const routesHealth = new Hono();

routesHealth.get("/health", (c) => {
  return c.json({
    success: true,
    data: {
      instanceName: _INSTANCE_NAME,
      serverVersion: _SERVER_VERSION,
      startTime: _START_TIME,
      currentTime: new Date().toISOString(),
      isHealthy: true,
    },
  });
});

routesHealth.get("/me", async (c) => {
  const globalUser = await getGlobalUser(c);
  if (globalUser === "NOT_AUTHENTICATED") {
    return c.json({ success: false, err: "Not authenticated" }, 401);
  }
  return c.json({ success: true, data: globalUser });
});
