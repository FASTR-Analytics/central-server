export const _IS_PRODUCTION = !!Deno.env.get("IS_PRODUCTION");

export const _INSTANCE_ID = Deno.env.get("INSTANCE_ID")!;
if (!_INSTANCE_ID) throw new Error("Missing INSTANCE_ID");

export const _INSTANCE_NAME = Deno.env.get("INSTANCE_NAME")!;
if (!_INSTANCE_NAME) throw new Error("Missing INSTANCE_NAME");

export const _PG_HOST = Deno.env.get("PG_HOST")!;
if (!_PG_HOST) throw new Error("Missing PG_HOST");

export const _PG_PORT = Deno.env.get("PG_PORT")!;
if (!_PG_PORT) throw new Error("Missing PG_PORT");

export const _PG_PASSWORD = Deno.env.get("PG_PASSWORD")!;
if (!_PG_PASSWORD) throw new Error("Missing PG_PASSWORD");

export const _SERVER_VERSION = Deno.env.get("SERVER_VERSION") ?? "dev";
export const _DATABASE_FOLDER = Deno.env.get("DATABASE_FOLDER") ?? "central";
export const _START_TIME = new Date().toISOString();

export const _BYPASS_AUTH = !!Deno.env.get("BYPASS_AUTH") && !_IS_PRODUCTION;

export const _CENTRAL_SERVER_SECRET = Deno.env.get("CENTRAL_SERVER_SECRET") ?? "";

export const _SERVERS_FILE_PATH = _IS_PRODUCTION
  ? "/app/servers.json"
  : (Deno.env.get("SERVERS_FILE_PATH") ?? "./servers.json");
