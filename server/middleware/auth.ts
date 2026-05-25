import { createMiddleware } from "hono/factory";
import type { GlobalUser } from "lib";
import { getGlobalUser } from "../auth.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export function requireAuth() {
  return createMiddleware<Env>(async (c, next) => {
    if (c.req.method === "OPTIONS") { await next(); return; }
    const user = await getGlobalUser(c);
    if (user === "NOT_AUTHENTICATED") {
      return c.json({ success: false, err: "Authentication required" }, 401);
    }
    c.set("globalUser", user);
    await next();
  });
}

export function requireHUser() {
  return createMiddleware<Env>(async (c, next) => {
    if (c.req.method === "OPTIONS") { await next(); return; }
    const user = await getGlobalUser(c);
    if (user === "NOT_AUTHENTICATED") {
      return c.json({ success: false, err: "Authentication required" }, 401);
    }
    if (!user.isHUser) {
      return c.json({ success: false, err: "Not authorized" }, 403);
    }
    c.set("globalUser", user);
    await next();
  });
}
