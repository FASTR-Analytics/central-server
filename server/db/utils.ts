import type { Sql } from "postgres";

export function getResultsObjectTableName(resultsObjectId: string): string {
  return "ro_" + resultsObjectId.replaceAll(".", "_").replaceAll("-", "_").replaceAll(" ", "_").toLowerCase();
}

export async function detectHasPeriodId(
  projectDb: Sql,
  tableName: string,
): Promise<boolean> {
  try {
    await projectDb.unsafe(`SELECT period_id FROM ${tableName} LIMIT 1`);
    return true;
  } catch (_e) {
    return false;
  }
}

export async function detectColumnExists(
  projectDb: Sql,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  try {
    await projectDb.unsafe(`SELECT ${columnName} FROM ${tableName} LIMIT 1`);
    return true;
  } catch (_e) {
    return false;
  }
}

export type APIResponseWithData<T> = { success: true; data: T } | { success: false; err: string };

export async function tryCatchDatabaseAsync<T>(
  func: () => Promise<APIResponseWithData<T>>,
): Promise<APIResponseWithData<T>> {
  try {
    return await func();
  } catch (e) {
    console.error(e);
    return { success: false, err: e instanceof Error ? e.message : String(e) };
  }
}
