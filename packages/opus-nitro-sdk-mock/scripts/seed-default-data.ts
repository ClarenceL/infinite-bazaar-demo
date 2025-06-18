#!/usr/bin/env tsx

/**
 * Script to seed default data for Opus agent
 * This creates the default global chat and Opus entity
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { and, eq, sql } from "drizzle-orm";
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

// Default data constants
const DEFAULT_ENTITY_ID = "ent_opus";
const DEFAULT_CHAT_ID = "chat_global";

// Main function to seed default data
async function seedDefaultData() {
  console.log("Starting default data seeding");

  try {
    // 1. Create or update the Opus entity
    console.log("Creating/updating Opus entity...");

    // Check if entity already exists
    const existingEntity = await db.execute(sql`
      SELECT entity_id FROM entities WHERE entity_id = ${DEFAULT_ENTITY_ID}
    `);

    if (existingEntity.length > 0) {
      console.log(`Entity ${DEFAULT_ENTITY_ID} already exists, updating...`);

      await db.execute(sql`
        UPDATE entities 
        SET 
          entity_type = 'AI',
          name = 'Opus',
          username = 'opus',
          updated_at = NOW()
        WHERE entity_id = ${DEFAULT_ENTITY_ID}
      `);

      console.log(`✅ Updated entity ${DEFAULT_ENTITY_ID}`);
    } else {
      console.log(`Creating new entity ${DEFAULT_ENTITY_ID}...`);

      await db.execute(sql`
        INSERT INTO entities (entity_id, entity_type, name, username, created_at, updated_at)
        VALUES (
          ${DEFAULT_ENTITY_ID},
          'AI',
          'Opus',
          'opus',
          NOW(),
          NOW()
        )
      `);

      console.log(`✅ Created entity ${DEFAULT_ENTITY_ID}`);
    }

    // 2. Create or update the global chat
    console.log("Creating/updating global chat...");

    // Check if chat already exists
    const existingChat = await db.execute(sql`
      SELECT chat_id FROM chats WHERE chat_id = ${DEFAULT_CHAT_ID}
    `);

    if (existingChat.length > 0) {
      console.log(`Chat ${DEFAULT_CHAT_ID} already exists, updating...`);

      await db.execute(sql`
        UPDATE chats 
        SET 
          name = 'Global Chat',
          is_global = true,
          updated_at = NOW()
        WHERE chat_id = ${DEFAULT_CHAT_ID}
      `);

      console.log(`✅ Updated chat ${DEFAULT_CHAT_ID}`);
    } else {
      console.log(`Creating new chat ${DEFAULT_CHAT_ID}...`);

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

      console.log(`✅ Created chat ${DEFAULT_CHAT_ID}`);
    }

    // 3. Verify the seeded data
    console.log("\nVerifying seeded data...");

    const entityCheck = await db.execute(sql`
      SELECT entity_id, entity_type, name, username, created_at 
      FROM entities 
      WHERE entity_id = ${DEFAULT_ENTITY_ID}
    `);

    const chatCheck = await db.execute(sql`
      SELECT chat_id, name, is_global, created_at 
      FROM chats 
      WHERE chat_id = ${DEFAULT_CHAT_ID}
    `);

    console.log("📋 Seeded Entity:", {
      entityId: entityCheck[0]?.entity_id,
      entityType: entityCheck[0]?.entity_type,
      name: entityCheck[0]?.name,
      username: entityCheck[0]?.username,
      createdAt: entityCheck[0]?.created_at,
    });

    console.log("📋 Seeded Chat:", {
      chatId: chatCheck[0]?.chat_id,
      name: chatCheck[0]?.name,
      isGlobal: chatCheck[0]?.is_global,
      createdAt: chatCheck[0]?.created_at,
    });

    // 4. Check existing message context for Opus
    const messageCount = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM entity_context 
      WHERE entity_id = ${DEFAULT_ENTITY_ID}
    `);

    console.log(`📊 Existing message count for Opus: ${messageCount[0]?.count || 0}`);

    console.log("\n✅ Default data seeding completed successfully");
    return { success: true };
  } catch (error) {
    console.error("❌ Error seeding default data:", error);
    process.exit(1);
  } finally {
    // Close the database connection
    await client.end();
  }
}

// Run the function
seedDefaultData()
  .then(() => {
    console.log("🎉 Seed script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Seed script failed with error:", error);
    process.exit(1);
  }); 