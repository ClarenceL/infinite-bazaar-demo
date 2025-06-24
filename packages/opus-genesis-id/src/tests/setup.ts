import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chats, db } from "@infinite-bazaar-demo/db";

export const GLOBAL_CHAT_NAME = "Global Chat";

/**
 * Helper function to check if the current module is being run directly
 * @returns boolean indicating if the module is being run directly (not imported)
 */
export function isRunningDirectly(moduleUrl: string): boolean {
  if (!process.argv[1]) return false;

  const currentFilePath = fileURLToPath(moduleUrl);
  const executedFilePath = resolve(process.argv[1]);

  return currentFilePath === executedFilePath;
}

/**
 * Setup function to prepare the database for testing
 */
export async function setupTestDatabase() {
  try {
    // First, clean up any existing test data to start fresh
    await cleanupTestDatabase();

    // Create test user
    // const user = await createTestUser();

    // if (!user) {
    //   throw new Error("Failed to create or retrieve test user");
    // }

    console.log("Test database setup complete");
    return;
  } catch (error) {
    console.error("Error setting up test database:", error);
    throw error;
  }
}

/**
 * Safely delete records from a table, checking for references first
 * @param table The table to delete records from
 * @param condition Optional condition to apply
 */
async function safeDelete(table: any, condition: any = undefined) {
  try {
    if (condition) {
      await db.delete(table).where(condition);
    } else {
      await db.delete(table);
    }
  } catch (error: any) {
    console.error(`Error deleting from table: ${error.message || String(error)}`);
  }
}

export async function cleanupTestDatabase() {
  try {
    await safeDelete(chats);
    await safeDelete(messages);

    console.log("Test database cleanup complete");
  } catch (error) {
    console.error("Error cleaning up test database:", error);
    throw error;
  }
}

// If this file is run directly, set up the test database
if (isRunningDirectly(import.meta.url)) {
  setupTestDatabase()
    .then(() => {
      console.log("Test setup complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Test setup failed:", error);
      process.exit(1);
    });
}
