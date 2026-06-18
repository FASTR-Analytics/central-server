import postgres from "postgres";
import { Sql } from "postgres";
import { _PG_HOST, _PG_PASSWORD, _PG_PORT } from "../../exposed_env_vars.ts";

const DEFAULT_CONNECTION_OPTIONS = {
  user: "postgres",
  hostname: _PG_HOST,
  password: _PG_PASSWORD,
  port: Number(_PG_PORT),
  max: 20,
  idle_timeout: 300,
  connect_timeout: 10,
  statement_timeout: 300000,
  query_timeout: 300000,
  prepare: true,
  onnotice: () => {},
  transform: { undefined: null },
} as const;

interface CachedConnection {
  sql: Sql;
  createdAt: Date;
  lastUsed: Date;
}

const _CACHED_CONNECTIONS = new Map<string, CachedConnection>();

export function getPgConnectionFromCacheOrNew(
  id: string,
  _permissions: "READ_ONLY" | "READ_AND_WRITE",
): Sql {
  const key = `${id}_${_permissions}`;
  const cached = _CACHED_CONNECTIONS.get(key);
  if (cached) {
    cached.lastUsed = new Date();
    return cached.sql;
  }
  const sql = postgres({ ...DEFAULT_CONNECTION_OPTIONS, database: id });
  _CACHED_CONNECTIONS.set(key, { sql, createdAt: new Date(), lastUsed: new Date() });
  return sql;
}

// Dedicated connection for bulk `COPY ... FROM STDIN` imports: NO statement_timeout (a
// single results-object COPY streams for minutes) and prepare:false. Not cached — the
// caller owns it and must `.end()` it. One writer per import job.
export function createWorkerWriteConnection(databaseId: string): Sql {
  return postgres({
    user: "postgres",
    hostname: _PG_HOST,
    password: _PG_PASSWORD,
    port: Number(_PG_PORT),
    database: databaseId,
    max: 2,
    idle_timeout: 600,
    connect_timeout: 30,
    prepare: false,
    onnotice: () => {},
    transform: { undefined: null },
  });
}

export async function closePgConnection(
  id: string,
  permissions?: "READ_ONLY" | "READ_AND_WRITE",
): Promise<void> {
  const keys = permissions
    ? [`${id}_${permissions}`]
    : [`${id}_READ_ONLY`, `${id}_READ_AND_WRITE`];
  for (const key of keys) {
    const conn = _CACHED_CONNECTIONS.get(key);
    if (conn) {
      _CACHED_CONNECTIONS.delete(key);
      await conn.sql.end().catch(() => {});
    }
  }
}
