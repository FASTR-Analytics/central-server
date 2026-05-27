import { Hono } from "hono";
import type { GlobalUser, InstanceUser } from "lib";
import { requireAdmin } from "../../middleware/auth.ts";
import { getPgConnectionFromCacheOrNew } from "../../db/mod.ts";
import type { DBUser } from "../../db/instance/_main_database_types.ts";

type Env = { Variables: { globalUser: GlobalUser } };

export const routesUsers = new Hono<Env>();

routesUsers.get("/users", requireAdmin(), async (c) => {
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");
  const rows = await mainDb<DBUser[]>`SELECT * FROM users ORDER BY email`;
  const data: InstanceUser[] = rows.map((u) => ({
    email: u.email,
    firstName: u.first_name ?? undefined,
    lastName: u.last_name ?? undefined,
    isAdmin: u.is_admin,
    canConfigureUsers: u.can_configure_users,
    canCreateProjects: u.can_create_projects,
  }));
  return c.json({ success: true, data });
});

routesUsers.post("/users", requireAdmin(), async (c) => {
  const { emails } = await c.req.json<{ emails: string[] }>();
  if (!emails?.length) return c.json({ success: false, err: "No emails provided" }, 400);
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");
  for (const email of emails) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) continue;
    await mainDb`INSERT INTO users (email) VALUES (${trimmed}) ON CONFLICT (email) DO NOTHING`;
  }
  return c.json({ success: true });
});

routesUsers.delete("/users/:email", requireAdmin(), async (c) => {
  const email = c.req.param("email");
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");
  await mainDb`DELETE FROM users WHERE email = ${email}`;
  return c.json({ success: true });
});

routesUsers.put("/users/:email/admin", requireAdmin(), async (c) => {
  const email = c.req.param("email");
  const { isAdmin } = await c.req.json<{ isAdmin: boolean }>();
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");
  await mainDb`UPDATE users SET is_admin = ${isAdmin} WHERE email = ${email}`;
  return c.json({ success: true });
});
