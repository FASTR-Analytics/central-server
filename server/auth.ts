import { getAuth } from "@hono/clerk-auth";
import type { Context } from "hono";
import { H_USERS, type GlobalUser } from "lib";
import { _BYPASS_AUTH } from "./exposed_env_vars.ts";

export async function getGlobalUser(c: Context): Promise<GlobalUser | "NOT_AUTHENTICATED"> {
  if (_BYPASS_AUTH) {
    return { email: "dev@dev.com", isHUser: true, approved: true };
  }

  const auth = getAuth(c);
  if (!auth?.userId) return "NOT_AUTHENTICATED";

  const email = auth.sessionClaims?.email as string | undefined;
  if (!email) return "NOT_AUTHENTICATED";

  return {
    email,
    isHUser: H_USERS.includes(email),
    approved: true,
  };
}
