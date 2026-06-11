import { Hono } from "hono";
import type { InstanceMeta } from "lib";
import {
  _DATABASE_FOLDER,
  _INSTANCE_ID,
  _INSTANCE_NAME,
  _IS_PRODUCTION,
  _SERVER_VERSION,
  _START_TIME,
} from "../../exposed_env_vars.ts";
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

routesHealth.get("/instance_meta", (c) => {
  const currentTime = new Date().toISOString();
  const startTime = new Date(_START_TIME);
  const uptimeMs = Date.now() - startTime.getTime();

  const instance: InstanceMeta = {
    instanceName: _INSTANCE_NAME,
    instanceId: _INSTANCE_ID,
    serverVersion: _SERVER_VERSION,
    startTime: _START_TIME,
    currentTime,
    uptimeMs,
    environment: _IS_PRODUCTION ? "production" : "development",
    databaseFolder: _DATABASE_FOLDER,
    isHealthy: true,
  };
  return c.json({
    success: true,
    data: instance,
  });
});

routesHealth.get("/me", async (c) => {
  const globalUser = await getGlobalUser(c);
  if (globalUser === "NOT_AUTHENTICATED") {
    return c.json({ success: false, err: "Not authenticated" }, 401);
  }
  return c.json({ success: true, data: globalUser });
});
