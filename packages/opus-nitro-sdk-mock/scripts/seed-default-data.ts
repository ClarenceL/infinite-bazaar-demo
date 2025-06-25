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
const DEFAULT_CHAT_ID = "chat_global";

// Entity data to seed
const ENTITIES_TO_SEED = [
  {
    entity_id: "ent_opus",
    entity_type: "AI",
    name: null,
    cdp_address: null,
    active: true,
    cdp_name: null,
    last_query_time: "2025-06-25 02:17:28.969+00",
    ai_prompt_id: "opus",
    anthropic_model: "claude-opus-4-20250514",
    chat_order: 999,
  },
  {
    entity_id: "ent_sonnet",
    entity_type: "AI",
    name: null,
    cdp_address: null,
    active: true,
    cdp_name: null,
    last_query_time: "2025-06-25 02:18:03.201+00",
    ai_prompt_id: "opus",
    anthropic_model: null,
    chat_order: 999,
  },
  {
    entity_id: "god_lyra",
    entity_type: "AI",
    name: "Lyra",
    cdp_address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    active: true,
    cdp_name: "opus-demo",
    last_query_time: "2025-06-25 02:18:36.375+00",
    ai_prompt_id: "lyra",
    anthropic_model: "claude-opus-4-20250514",
    chat_order: 0,
  },
];

// Main function to seed default data
async function seedDefaultData() {
  console.log("Starting default data seeding");

  try {
    // 1. Create or update entities
    console.log("Creating/updating entities...");

    for (const entity of ENTITIES_TO_SEED) {
      // Check if entity already exists
      const existingEntity = await db.execute(sql`
        SELECT entity_id FROM entities WHERE entity_id = ${entity.entity_id}
      `);

      if (existingEntity.length > 0) {
        console.log(`Entity ${entity.entity_id} already exists, updating...`);

        await db.execute(sql`
          UPDATE entities 
          SET 
            entity_type = ${entity.entity_type},
            name = ${entity.name},
            cdp_address = ${entity.cdp_address},
            active = ${entity.active},
            cdp_name = ${entity.cdp_name},
            last_query_time = ${entity.last_query_time},
            ai_prompt_id = ${entity.ai_prompt_id},
            anthropic_model = ${entity.anthropic_model},
            chat_order = ${entity.chat_order},
            updated_at = NOW()
          WHERE entity_id = ${entity.entity_id}
        `);

        console.log(`✅ Updated entity ${entity.entity_id}`);
      } else {
        console.log(`Creating new entity ${entity.entity_id}...`);

        await db.execute(sql`
          INSERT INTO entities (
            entity_id, entity_type, name, cdp_address, active, 
            cdp_name, last_query_time, ai_prompt_id, anthropic_model, 
            chat_order, created_at, updated_at
          )
          VALUES (
            ${entity.entity_id},
            ${entity.entity_type},
            ${entity.name},
            ${entity.cdp_address},
            ${entity.active},
            ${entity.cdp_name},
            ${entity.last_query_time},
            ${entity.ai_prompt_id},
            ${entity.anthropic_model},
            ${entity.chat_order},
            NOW(),
            NOW()
          )
        `);

        console.log(`✅ Created entity ${entity.entity_id}`);
      }
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
      SELECT entity_id, entity_type, name, cdp_address, active, cdp_name, 
             ai_prompt_id, anthropic_model, chat_order, created_at 
      FROM entities 
      WHERE entity_id IN ('ent_opus', 'ent_sonnet', 'god_lyra')
      ORDER BY chat_order, entity_id
    `);

    const chatCheck = await db.execute(sql`
      SELECT chat_id, name, is_global, created_at 
      FROM chats 
      WHERE chat_id = ${DEFAULT_CHAT_ID}
    `);

    console.log("📋 Seeded Entities:");
    for (const entity of entityCheck) {
      console.log({
        entityId: entity.entity_id,
        entityType: entity.entity_type,
        name: entity.name,
        cdpAddress: entity.cdp_address,
        active: entity.active,
        cdpName: entity.cdp_name,
        aiPromptId: entity.ai_prompt_id,
        anthropicModel: entity.anthropic_model,
        chatOrder: entity.chat_order,
        createdAt: entity.created_at,
      });
    }

    console.log("📋 Seeded Chat:", {
      chatId: chatCheck[0]?.chat_id,
      name: chatCheck[0]?.name,
      isGlobal: chatCheck[0]?.is_global,
      createdAt: chatCheck[0]?.created_at,
    });

    // 4. Check existing message context for all entities
    for (const entityData of ENTITIES_TO_SEED) {
      const messageCount = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM entity_context 
        WHERE entity_id = ${entityData.entity_id}
      `);

      console.log(
        `📊 Existing message count for ${entityData.entity_id}: ${messageCount[0]?.count || 0}`,
      );
    }

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
