import { clerkMiddleware } from "@hono/clerk-auth";
import { cors } from "hono/cors";
import { _BYPASS_AUTH } from "../exposed_env_vars.ts";

export const authMiddleware = _BYPASS_AUTH
  ? async (_c: unknown, next: () => Promise<void>) => await next()
  : clerkMiddleware();

export const corsMiddleware = cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Project-Id"],
});

export { requireAuth, requireHUser } from "./auth.ts";
export { setupStaticServing } from "./static.ts";
