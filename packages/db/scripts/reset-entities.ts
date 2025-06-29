#!/usr/bin/env tsx

/**
 * Reset script to clear entity data and ensure global chat exists
 * This script:
 * 1. Sets name, cdp_name, and cdp_address to NULL for all entities except god_lyra
 * 2. Ensures the global chat exists
 * 3. Optionally deletes all entity_context (chat messages) with --delete-chats flag
 * 4. Resets agent_relationships, x402_endpoints, and x402_service_calls tables
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Get the directory name using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment and load appropriate .env file
const env = process.env.NODE_ENV || "development";
console.log(`Using environment: ${env}`);

// Load the appropriate .env file
const envFile = `.env${env !== "development" ? `.${env}` : ""}`;
const envPath = path.resolve(process.cwd(), envFile);
const result = config({ path: envPath });

if (result.error) {
  console.error(`Error loading ${envFile}:`, result.error);
  process.exit(1);
}

console.log(`Loaded environment from ${envFile}`);
console.log(
  `DATABASE_URL: ${process.env.DATABASE_URL?.replace(/(postgresql:\/\/)([^:]+):([^@]+)@/, "$1$2:****@")}`,
);

// Initialize PostgreSQL client with connection pooling
const client = postgres(process.env.DATABASE_URL!, {
  max: 1, // Maximum number of connections
  idle_timeout: 10, // Maximum idle time in seconds
  prepare: false, // Disable prepared statements to avoid parameter binding issues
});

// Create a Drizzle ORM instance
const db = drizzle(client);

// Constants
const PROTECTED_ENTITY_ID = "god_lyra";
const DEFAULT_CHAT_ID = "chat_global";

// Parse command line arguments
const args = process.argv.slice(2);
const deleteChats = args.includes("--delete-chats");

// Main function to reset entities and ensure global chat
async function resetEntitiesAndChat() {
  console.log("Starting entity reset and chat verification");

  if (deleteChats) {
    console.log("⚠️  --delete-chats flag detected: Will delete all chat messages");
  }

  try {
    // 1. Delete entity_context if --delete-chats flag is provided
    if (deleteChats) {
      console.log("🗑️  Deleting all entity_context (chat messages)...");

      const deleteResult = await db.execute(sql`
        DELETE FROM entity_context
      `);

      console.log(`✅ Deleted ${deleteResult.count || 0} chat messages from entity_context`);
    }

    // 1.5. Reset x402 and relationship tables
    console.log("🗑️  Resetting x402_service_calls table...");
    const deleteServiceCallsResult = await db.execute(sql`
      DELETE FROM x402_service_calls
    `);
    console.log(
      `✅ Deleted ${deleteServiceCallsResult.count || 0} records from x402_service_calls`,
    );

    console.log("🗑️  Resetting x402_endpoints table...");
    const deleteEndpointsResult = await db.execute(sql`
      DELETE FROM x402_endpoints
    `);
    console.log(`✅ Deleted ${deleteEndpointsResult.count || 0} records from x402_endpoints`);

    console.log("🗑️  Resetting agent_relationships table...");
    const deleteRelationshipsResult = await db.execute(sql`
      DELETE FROM agent_relationships
    `);
    console.log(
      `✅ Deleted ${deleteRelationshipsResult.count || 0} records from agent_relationships`,
    );

    // 2. Reset entity fields (except for god_lyra)
    console.log(`Resetting entity fields for all entities except ${PROTECTED_ENTITY_ID}...`);

    const resetResult = await db.execute(sql`
      UPDATE entities 
      SET 
        name = NULL,
        cdp_name = NULL,
        cdp_address = NULL,
        updated_at = NOW()
      WHERE entity_id != ${PROTECTED_ENTITY_ID}
    `);

    console.log(`✅ Reset ${resetResult.count || 0} entities (excluded ${PROTECTED_ENTITY_ID})`);

    // 2.5. Set god_lyra's chat_order to 0 to ensure she goes first
    console.log(`Setting ${PROTECTED_ENTITY_ID} chat_order to 0...`);

    const updateOrderResult = await db.execute(sql`
      UPDATE entities 
      SET 
        chat_order = 0,
        updated_at = NOW()
      WHERE entity_id = ${PROTECTED_ENTITY_ID}
    `);

    console.log(
      `✅ Set ${PROTECTED_ENTITY_ID} chat_order to 0 (${updateOrderResult.count || 0} entities updated)`,
    );

    // 3. Check if global chat exists and create if missing
    console.log("Checking for global chat...");

    const existingChat = await db.execute(sql`
      SELECT chat_id FROM chats WHERE chat_id = ${DEFAULT_CHAT_ID}
    `);

    if (existingChat.length > 0) {
      console.log(`✅ Global chat ${DEFAULT_CHAT_ID} already exists`);
    } else {
      console.log(`Creating missing global chat ${DEFAULT_CHAT_ID}...`);

      await db.execute(sql`
        INSERT INTO chats (chat_id, name, is_global, created_at, updated_at)
        VALUES (
          ${DEFAULT_CHAT_ID},
          'Global Chat',
          true,
          NOW(),
          NOW()
        )
      `);

      console.log(`✅ Created global chat ${DEFAULT_CHAT_ID}`);
    }

    // 4. Verify the reset operation
    console.log("\nVerifying reset results...");

    const resetEntities = await db.execute(sql`
      SELECT entity_id, name, cdp_name, cdp_address, chat_order 
      FROM entities 
      WHERE entity_id != ${PROTECTED_ENTITY_ID}
      ORDER BY entity_id
    `);

    const protectedEntity = await db.execute(sql`
      SELECT entity_id, name, cdp_name, cdp_address, chat_order 
      FROM entities 
      WHERE entity_id = ${PROTECTED_ENTITY_ID}
    `);

    const globalChat = await db.execute(sql`
      SELECT chat_id, name, is_global 
      FROM chats 
      WHERE chat_id = ${DEFAULT_CHAT_ID}
    `);

    // Check remaining counts for all tables
    const remainingMessages = await db.execute(sql`
      SELECT COUNT(*) as count FROM entity_context
    `);

    const remainingRelationships = await db.execute(sql`
      SELECT COUNT(*) as count FROM agent_relationships
    `);

    const remainingEndpoints = await db.execute(sql`
      SELECT COUNT(*) as count FROM x402_endpoints
    `);

    const remainingServiceCalls = await db.execute(sql`
      SELECT COUNT(*) as count FROM x402_service_calls
    `);

    console.log("📋 Reset Entities:");
    resetEntities.forEach((entity) => {
      console.log(
        `  - ${entity.entity_id}: name=${entity.name}, cdp_name=${entity.cdp_name}, cdp_address=${entity.cdp_address}, chat_order=${entity.chat_order}`,
      );
    });

    console.log("📋 Protected Entity:");
    if (protectedEntity.length > 0) {
      const entity = protectedEntity[0];
      console.log(
        `  - ${entity.entity_id}: name=${entity.name}, cdp_name=${entity.cdp_name}, cdp_address=${entity.cdp_address}, chat_order=${entity.chat_order}`,
      );
    } else {
      console.log(`  - ${PROTECTED_ENTITY_ID}: NOT FOUND`);
    }

    console.log("📋 Global Chat:");
    if (globalChat.length > 0) {
      const chat = globalChat[0];
      console.log(`  - ${chat.chat_id}: name=${chat.name}, is_global=${chat.is_global}`);
    }

    console.log("📋 Table Reset Summary:");
    const messageCount = Number(remainingMessages[0]?.count) || 0;
    const relationshipCount = Number(remainingRelationships[0]?.count) || 0;
    const endpointCount = Number(remainingEndpoints[0]?.count) || 0;
    const serviceCallCount = Number(remainingServiceCalls[0]?.count) || 0;

    console.log(`  - Entity Context (messages): ${messageCount}`);
    console.log(`  - Agent Relationships: ${relationshipCount}`);
    console.log(`  - X402 Endpoints: ${endpointCount}`);
    console.log(`  - X402 Service Calls: ${serviceCallCount}`);

    if (deleteChats && messageCount === 0) {
      console.log("  ✅ All chat messages successfully deleted");
    } else if (deleteChats && messageCount > 0) {
      console.log("  ⚠️  Some messages may not have been deleted");
    }

    if (relationshipCount === 0 && endpointCount === 0 && serviceCallCount === 0) {
      console.log("  ✅ All x402 and relationship tables successfully reset");
    } else {
      console.log("  ⚠️  Some records may not have been deleted from x402/relationship tables");
    }

    console.log("\n✅ Reset operation completed successfully");
    return { success: true };
  } catch (error) {
    console.error("❌ Error during reset operation:", error);
    process.exit(1);
  } finally {
    // Close the database connection
    await client.end();
  }
}

// Show usage information
function showUsage() {
  console.log("Usage: tsx reset-entities.ts [OPTIONS]");
  console.log("");
  console.log("Options:");
  console.log("  --delete-chats    Delete all entity_context (chat messages)");
  console.log("  --help           Show this help message");
  console.log("");
  console.log("Examples:");
  console.log("  tsx reset-entities.ts");
  console.log("  tsx reset-entities.ts --delete-chats");
}

// Handle help flag
if (args.includes("--help") || args.includes("-h")) {
  showUsage();
  process.exit(0);
}

// Run the function
resetEntitiesAndChat()
  .then(() => {
    console.log("🎉 Reset script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Reset script failed with error:", error);
    process.exit(1);
  });
