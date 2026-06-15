import { getAuth } from "@hono/clerk-auth";
import type { Context } from "hono";
import { H_USERS, type GlobalUser } from "lib";
import { _BYPASS_AUTH } from "./exposed_env_vars.ts";
import { getPgConnectionFromCacheOrNew } from "./db/mod.ts";
import type { DBUser } from "./db/instance/_main_database_types.ts";

export async function getGlobalUser(c: Context): Promise<GlobalUser | "NOT_AUTHENTICATED"> {
  if (_BYPASS_AUTH) {
    return {
      email: "dev@dev.com",
      isHUser: true,
      isAdmin: true,
      approved: true,
      canConfigureUsers: true,
      canCreateProjects: true,
    };
  }

  const auth = getAuth(c);
  if (!auth?.userId) return "NOT_AUTHENTICATED";

  const email = auth.sessionClaims?.email as string | undefined;
  if (!email) return "NOT_AUTHENTICATED";

  // Names come from the live Clerk session claims (matches the platform), so they
  // display even for h_users and users whose DB name hasn't been synced yet.
  const firstName = (auth.sessionClaims?.given_name as string | undefined)
    ?? (auth.sessionClaims?.firstName as string | undefined);
  const lastName = (auth.sessionClaims?.family_name as string | undefined)
    ?? (auth.sessionClaims?.lastName as string | undefined);

  const isHUser = H_USERS.includes(email);

  // h_users bypass the DB check — they always have full access
  if (isHUser) {
    return {
      email,
      firstName,
      lastName,
      isHUser: true,
      isAdmin: true,
      approved: true,
      canConfigureUsers: true,
      canCreateProjects: true,
    };
  }

  // Regular users must be in the users table
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_ONLY");
  const rows = await mainDb<DBUser[]>`SELECT * FROM users WHERE email = ${email}`;
  const user = rows.at(0);

  if (!user) {
    return {
      email,
      firstName,
      lastName,
      isHUser: false,
      isAdmin: false,
      approved: false,
      canConfigureUsers: false,
      canCreateProjects: false,
    };
  }

  // Fire-and-forget name sync from Clerk claims
  if ((firstName || lastName) && !user.first_name) {
    getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE")`
      UPDATE users SET first_name = ${firstName ?? null}, last_name = ${lastName ?? null}
      WHERE email = ${email} AND first_name IS NULL
    `.catch(() => {});
  }

  return {
    email,
    isHUser: false,
    isAdmin: user.is_admin,
    approved: true,
    firstName: firstName ?? user.first_name ?? undefined,
    lastName: lastName ?? user.last_name ?? undefined,
    canConfigureUsers: user.is_admin || user.can_configure_users,
    canCreateProjects: user.is_admin || user.can_create_projects,
  };
}
