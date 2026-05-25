import type { Sql } from "postgres";
import { getPgConnectionFromCacheOrNew } from "./postgres/mod.ts";

const mainDbSql = await Deno.readTextFile(
  new URL("./instance/_main_database.sql", import.meta.url).pathname,
);

const projectDbSql = await Deno.readTextFile(
  new URL("./project/_project_database.sql", import.meta.url).pathname,
);

export async function dbStartUp(): Promise<void> {
  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");
  await mainDb.unsafe(mainDbSql);
  console.log("✓ Main database ready");
}

export async function initProjectDb(projectDb: Sql): Promise<void> {
  await projectDb.unsafe(projectDbSql);
}
