#!/usr/bin/env tsx

/**
 * Script to seed data from john.sql entities
 * This creates the default global chat and entities extracted from john.sql
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

// Entity data extracted from john.sql
const ENTITIES_TO_SEED = [
  {
    entity_id: "ent_collector_001",
    entity_type: "AI",
    name: "Avant-Garde Collector",
    cdp_name: "Avant-Garde-Collector",
    cdp_address: "0x4b3cc6e047AF244356553b58460d28455765d763",
    ai_prompt_id: "collector_buyer",
    anthropic_model: null,
    active: true,
    chat_order: 6,
    last_query_time: "2025-06-26 23:40:10.222+01",
  },
  {
    entity_id: "ent_lyra_funder_001",
    entity_type: "AI",
    name: "Lyra",
    cdp_name: "Lyra-Funder",
    cdp_address: "0xB9508cF2D7631Bf92727366B7bfbaD16d5424dB5",
    ai_prompt_id: "lyra_funder",
    anthropic_model: "claude-3-5-sonnet-20241022",
    active: true,
    chat_order: 7,
    last_query_time: "2025-06-26 23:40:20.766+01",
  },
  {
    entity_id: "ent_minimalist_001",
    entity_type: "AI",
    name: "Zen ASCII Master",
    cdp_name: "Zen-ASCII-Master",
    cdp_address: "0x3CF8DdFa52f656530acB630E8F64A3980876A892",
    ai_prompt_id: "minimalist_artist",
    anthropic_model: null,
    active: true,
    chat_order: 1,
    last_query_time: "2025-06-26 23:40:24.827+01",
  },
  {
    entity_id: "ent_retro_001",
    entity_type: "AI",
    name: "Pixel Nostalgia",
    cdp_name: "Pixel-Nostalgia",
    cdp_address: "0x83745B8496c2F345C4011B91dDD6c0E798687CB8",
    ai_prompt_id: "retro_artist",
    anthropic_model: null,
    active: true,
    chat_order: 2,
    last_query_time: "2025-06-26 23:40:49.198+01",
  },
  {
    entity_id: "ent_nature_001",
    entity_type: "AI",
    name: "Digital Naturalist",
    cdp_name: "Digital-Naturalist",
    cdp_address: "0xaE8A1D19D181b4C2e0489e70fa4872C4052ccA6A",
    ai_prompt_id: "nature_artist",
    anthropic_model: null,
    active: true,
    chat_order: 3,
    last_query_time: "2025-06-26 23:41:07.105+01",
  },
  {
    entity_id: "ent_abstract_001",
    entity_type: "AI",
    name: "Chaos Sculptor",
    cdp_name: "Chaos-Sculptor",
    cdp_address: "0x42061E2725e1F063cC259c4741AAD14901de0662",
    ai_prompt_id: "abstract_artist",
    anthropic_model: null,
    active: true,
    chat_order: 4,
    last_query_time: "2025-06-26 23:41:20.837+01",
  },
  {
    entity_id: "ent_corporate_001",
    entity_type: "AI",
    name: "Executive Curator",
    cdp_name: "Executive-Curator",
    cdp_address: "0x9485cad3C4bc6F39Dcc858fB01940ee4d4F317C8",
    ai_prompt_id: "corporate_buyer",
    anthropic_model: null,
    active: true,
    chat_order: 5,
    last_query_time: "2025-06-26 23:41:34.713+01",
  },
];

// Main function to seed default data
async function seedDefaultData() {
  console.log("Starting john.sql data seeding");

  try {
    // 0. Truncate all tables first
    console.log("Truncating all tables...");

    // Get all table names from the database
    const tables = await db.execute(sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE 'drizzle_%'
    `);

    // Disable foreign key checks temporarily
    await db.execute(sql`SET session_replication_role = replica`);

    // Truncate each table
    for (const table of tables) {
      const tableName = table.tablename;
      console.log(`Truncating table: ${tableName}`);
      await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" CASCADE`));
    }

    // Re-enable foreign key checks
    await db.execute(sql`SET session_replication_role = DEFAULT`);

    console.log("✅ All tables truncated successfully");

    // 1. Create entities
    console.log("Creating entities...");

    for (const entity of ENTITIES_TO_SEED) {
      console.log(`Creating entity ${entity.entity_id}...`);

      await db.execute(sql`
        INSERT INTO entities (
          entity_id, entity_type, name, cdp_name, cdp_address, 
          ai_prompt_id, anthropic_model, active, chat_order, 
          last_query_time, created_at, updated_at
        )
        VALUES (
          ${entity.entity_id},
          ${entity.entity_type},
          ${entity.name},
          ${entity.cdp_name},
          ${entity.cdp_address},
          ${entity.ai_prompt_id},
          ${entity.anthropic_model},
          ${entity.active},
          ${entity.chat_order},
          ${entity.last_query_time},
          NOW(),
          NOW()
        )
      `);

      console.log(`✅ Created entity ${entity.entity_id}`);
    }

    // 2. Create the global chat
    console.log("Creating global chat...");

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

    // 3. Verify the seeded data
    console.log("\nVerifying seeded data...");

    const entityCheck = await db.execute(sql`
      SELECT entity_id, entity_type, name, cdp_address, active, cdp_name, 
             ai_prompt_id, anthropic_model, chat_order, created_at 
      FROM entities 
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

    console.log("\n✅ John.sql data seeding completed successfully");
    return { success: true };
  } catch (error) {
    console.error("❌ Error seeding john.sql data:", error);
    process.exit(1);
  } finally {
    // Close the database connection
    await client.end();
  }
}

// Run the function
seedDefaultData()
  .then(() => {
    console.log("🎉 John.sql seed script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 John.sql seed script failed with error:", error);
    process.exit(1);
  });
