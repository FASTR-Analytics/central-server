import type { Sql } from "postgres";
import { getPgConnectionFromCacheOrNew } from "./postgres/mod.ts";

const mainDbSql = await Deno.readTextFile(
  new URL("./instance/_main_database.sql", import.meta.url).pathname,
);

const projectDbSql = await Deno.readTextFile(
  new URL("./project/_project_database.sql", import.meta.url).pathname,
);

export async function dbStartUp(): Promise<void> {
  const postgresDb = getPgConnectionFromCacheOrNew("postgres", "READ_AND_WRITE");
  const existing = await postgresDb<
    object[]
  >`SELECT datname FROM pg_catalog.pg_database WHERE datname = 'main'`;

  if (existing.length === 0) {
    await postgresDb`CREATE DATABASE main`;
    console.log("✓ Created main database");
  }

  const mainDb = getPgConnectionFromCacheOrNew("main", "READ_AND_WRITE");
  await mainDb.unsafe(mainDbSql);
  console.log("✓ Main database ready");

  const projects = await mainDb<{ id: string }[]>`SELECT id FROM projects`;
  for (const project of projects) {
    const projectDb = getPgConnectionFromCacheOrNew(project.id, "READ_AND_WRITE");
    await initProjectDb(projectDb);
    console.log(`✓ Project database ready: ${project.id}`);
  }
}

export async function initProjectDb(projectDb: Sql): Promise<void> {
  await projectDb.unsafe(projectDbSql);
}
