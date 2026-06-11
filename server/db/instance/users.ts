import type { Sql } from "postgres";
import { tryCatchDatabaseAsync } from "../utils.ts";
import type { APIResponseWithData } from "../utils.ts";

export type BatchUser = {
  email: string;
  is_admin: string;
};

export async function batchUploadUsers(
  mainDb: Sql,
  batchUsers: BatchUser[],
  replaceAllExisting = false,
  currentUserEmail?: string,
): Promise<APIResponseWithData<Record<never, never>>> {
  return await tryCatchDatabaseAsync(async () => {
    if (batchUsers.length === 0) {
      return {
        success: false,
        err: "The CSV file contains no users",
      };
    }

    // Validate required fields
    for (const batchUser of batchUsers) {
      if (!batchUser.email) {
        return {
          success: false,
          err: "Each row must have an email address",
        };
      }

      // Validate email format (basic check)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(batchUser.email)) {
        return {
          success: false,
          err: `Invalid email format: ${batchUser.email}`,
        };
      }

      // Validate is_admin field
      if (!["true", "false"].includes(batchUser.is_admin.toLowerCase())) {
        return {
          success: false,
          err: `is_admin must be 'true' or 'false', got: ${batchUser.is_admin}`,
        };
      }
    }

    // Check if current user would lose admin status or be deleted
    if (currentUserEmail) {
      const currentUserInBatch = batchUsers.find(
        (u) => u.email === currentUserEmail,
      );
      if (
        replaceAllExisting &&
        (!currentUserInBatch ||
          currentUserInBatch.is_admin.toLowerCase() !== "true")
      ) {
        return {
          success: false,
          err: "You cannot replace all existing users without including yourself as admin. Ask another admin to do this.",
        };
      }
      if (
        currentUserInBatch &&
        currentUserInBatch.is_admin.toLowerCase() === "false"
      ) {
        return {
          success: false,
          err: "You cannot remove yourself as admin. Ask another admin to do this.",
        };
      }
    }

    // Process the batch users in a transaction
    await mainDb.begin(async (sql) => {
      // If replaceAllExisting is true, delete all existing users first
      // (project_user_roles rows cascade)
      if (replaceAllExisting) {
        await sql`
          DELETE FROM users
        `;
      }

      for (const batchUser of batchUsers) {
        const isAdmin = batchUser.is_admin.toLowerCase() === "true";

        // Insert or update the user
        await sql`
          INSERT INTO users (email, is_admin)
          VALUES (${batchUser.email.trim().toLowerCase()}, ${isAdmin})
          ON CONFLICT (email)
          DO UPDATE SET
            is_admin = EXCLUDED.is_admin
        `;
      }
    });

    return { success: true, data: {} };
  });
}
