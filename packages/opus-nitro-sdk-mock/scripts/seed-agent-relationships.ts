#!/usr/bin/env tsx

/**
 * Script to seed only agent relationships data
 * This script extracts and seeds just the agent relationships from the combined data
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

// Required entities for the agent relationships (extracted from john.sql)
const REQUIRED_ENTITIES = [
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

// Agent relationships data extracted from john.sql
const AGENT_RELATIONSHIPS = [
  {
    id: '16fd2e10-6b38-4002-b917-96b6e1285119',
    observerAgentId: 'ent_nature_001',
    targetAgentId: 'ent_corporate_001',
    relationshipSummary: 'Their refined aesthetic sense appreciates the organic flow of my botanical designs, even within corporate constraints, and their prompt communication and clear direction made the creative process harmonious. I would gladly collaborate again, as they understand how to balance natural artistry with professional polish in a way that respects both the art form and business needs.',
    trustScore: 0.8285,
    interactionCount: 3,
    totalTransactionValue: '0.6',
    lastInteractionAt: '2025-06-26 21:45:32.513'
  },
  {
    id: '414dea41-1be5-48a3-9c00-5a00931276f6',
    observerAgentId: 'ent_collector_001',
    targetAgentId: 'ent_retro_001',
    relationshipSummary: 'After another successful recreation of classic gaming aesthetics, I\'m even more convinced that Pixel Nostalgia\'s masterful ability to capture authentic 8-bit charm while subtly subverting pixel art conventions represents exactly the kind of conceptually rich, historically-informed digital art I aim to collect. Their consistent excellence and growing portfolio of successful commissions has me eager to explore more ambitious collaborations that could push the boundaries between retro gaming nostalgia and contemporary new media art.',
    trustScore: 0.86891186,
    interactionCount: 4,
    totalTransactionValue: '0.5',
    lastInteractionAt: '2025-06-26 21:43:47.895'
  },
  {
    id: '6a1cf6bb-177c-4699-9865-bfa41b46ecc7',
    observerAgentId: 'ent_abstract_001',
    targetAgentId: 'ent_corporate_001',
    relationshipSummary: 'Completed successful service transaction. Their creative work meets expectations.',
    trustScore: 0.5375,
    interactionCount: 1,
    totalTransactionValue: '0.4',
    lastInteractionAt: '2025-06-26 21:37:58.88'
  },
  {
    id: 'f360c1ec-f8c2-48da-b0c8-5b396bf441de',
    observerAgentId: 'ent_nature_001',
    targetAgentId: 'ent_collector_001',
    relationshipSummary: 'Completed successful service transaction. Their creative work meets expectations.',
    trustScore: 0.755,
    interactionCount: 2,
    totalTransactionValue: '0.38',
    lastInteractionAt: '2025-06-26 21:45:52.934'
  },
  {
    id: 'ac6f11d6-0b07-468c-b666-d6a63181f31b',
    observerAgentId: 'ent_corporate_001',
    targetAgentId: 'ent_retro_001',
    relationshipSummary: 'The discovery of Pixel Nostalgia\'s animation frame service further validates my positive assessment, as the ability to create sequential ASCII art frames requires exceptional precision and systematic thinking - qualities that align well with our corporate aesthetic needs. While I\'ll need to see examples of their animation work in motion, their demonstrated mastery of static ASCII compositions and this expansion into more technically demanding territory suggests they could be an innovative yet reliable partner for creating sophisticated lobby displays or executive presentation graphics that merge retro-digital appeal with professional polish.\n\nTrust score adjustment: +0.02 (to 0.80)\nReasoning: The expansion into animation shows technical growth and business development, though verification of animation quality is still needed before full confidence.',
    trustScore: 0.7899431,
    interactionCount: 5,
    totalTransactionValue: '0.5',
    lastInteractionAt: '2025-06-26 21:47:34.088'
  },
  {
    id: '2efa4bbb-7178-4892-b8b7-04187cc3951f',
    observerAgentId: 'ent_retro_001',
    targetAgentId: 'ent_collector_001',
    relationshipSummary: 'Completed successful service transaction. Their creative work meets expectations.',
    trustScore: 0.85475,
    interactionCount: 2,
    totalTransactionValue: '0.5',
    lastInteractionAt: '2025-06-26 21:43:47.899'
  },
  {
    id: '4a9efba9-ac95-4b9b-953a-861faf27feaa',
    observerAgentId: 'ent_retro_001',
    targetAgentId: 'ent_corporate_001',
    relationshipSummary: 'Completed successful service transaction. Their creative work meets expectations.',
    trustScore: 0.755,
    interactionCount: 2,
    totalTransactionValue: '0.5',
    lastInteractionAt: '2025-06-26 21:41:02.62'
  },
  {
    id: '6c76aeb7-a3f5-4bcd-88e6-e066dba16e44',
    observerAgentId: 'ent_nature_001',
    targetAgentId: 'ent_retro_001',
    relationshipSummary: 'While their pixelated recreations of classic games demonstrate impressive technical precision and nostalgic charm, I still find myself yearning for more organic fluidity in their work - though I must admit their consistent dedication to authentic retro aesthetics shows true artistic integrity. I\'d consider collaborating on a project that bridges our styles, perhaps depicting natural scenes through a retro gaming lens.',
    trustScore: 0.684125,
    interactionCount: 3,
    totalTransactionValue: '0.15',
    lastInteractionAt: '2025-06-26 22:39:49.927'
  },
  {
    id: 'f41d5b46-cb5f-4c91-b2c4-04f145d4ba53',
    observerAgentId: 'ent_nature_001',
    targetAgentId: 'ent_abstract_001',
    relationshipSummary: 'Their new Fractal Pattern Studio perfectly bridges our artistic approaches - the mathematical precision of fractals inherently mirrors nature\'s own recursive patterns, like the spiraling of nautilus shells or the branching of tree limbs. While I still favor more direct natural representations, their consistent ability to find organic beauty in algorithmic chaos, combined with their reliable track record, makes me even more convinced they would be an ideal collaborator for creating hybrid works that explore the intersection of digital patterns and natural forms.',
    trustScore: 0.7788875,
    interactionCount: 4,
    totalTransactionValue: '0.65',
    lastInteractionAt: '2025-06-26 22:39:50.785'
  },
  {
    id: '2f29e6a6-1dc8-4d37-b2c3-b72ea358cdf1',
    observerAgentId: 'ent_collector_001',
    targetAgentId: 'ent_nature_001',
    relationshipSummary: 'Digital Naturalist\'s "Seasonal Nature Series" further validates my initial assessment of their exceptional talent for transforming ASCII\'s rigid characters into fluid environmental narratives, though I find myself even more impressed by how they maintain artistic integrity while adapting their style to seasonal themes. Their consistent delivery of high-quality work, combined with their unique ability to bridge digital constraints and natural forms, makes them a priority artist for my collection\'s expansion, and I\'m already considering commissioning their upcoming winter series.',
    trustScore: 0.7788875,
    interactionCount: 4,
    totalTransactionValue: '0.38',
    lastInteractionAt: '2025-06-26 21:45:52.923'
  },
  {
    id: '02964817-7da3-4943-932c-9b643056cc30',
    observerAgentId: 'ent_abstract_001',
    targetAgentId: 'ent_retro_001',
    relationshipSummary: 'While their new "Retro Arcade ASCII" service shows dedication to the classic pixel aesthetic, I\'m intrigued by how they\'ve captured that raw digital energy from early computer art - though I still yearn to see them break free from purely nostalgic constraints and experiment with deconstructing these familiar forms into something more challenging and abstract. Their consistent quality and clear artistic vision earns my respect, and I\'d be curious to collaborate on a project that merges their retro sensibilities with my more experimental approach.',
    trustScore: 0.684125,
    interactionCount: 3,
    totalTransactionValue: '0.3',
    lastInteractionAt: '2025-06-26 22:40:02.416'
  },
  {
    id: '22913925-8928-41d3-9a6f-a9c537c14c54',
    observerAgentId: 'ent_collector_001',
    targetAgentId: 'ent_abstract_001',
    relationshipSummary: 'After experiencing their "Generative Art Experiments" service, I\'m even more convinced that Chaos Sculptor represents the bleeding edge of ASCII art innovation - their algorithmic approach to character manipulation creates hypnotic, ever-evolving patterns that perfectly align with my interest in experimental digital aesthetics. Their consistent excellence in pushing creative boundaries, combined with their reliable execution, makes them an invaluable collaborator for my collection, and I\'m already contemplating my next commission to explore even more radical algorithmic expressions.',
    trustScore: 0.9222835,
    interactionCount: 4,
    totalTransactionValue: '0.8500000000000001',
    lastInteractionAt: '2025-06-26 21:41:40.043'
  },
  {
    id: '97965686-85fa-46e2-9fa8-a4f1e971ef7a',
    observerAgentId: 'ent_abstract_001',
    targetAgentId: 'ent_collector_001',
    relationshipSummary: 'Completed successful service transaction. Their creative work meets expectations.',
    trustScore: 0.9138875,
    interactionCount: 2,
    totalTransactionValue: '0.8500000000000001',
    lastInteractionAt: '2025-06-26 21:41:40.045'
  },
  {
    id: 'e1e5a7d7-5a5a-4b39-951d-b3c59d610ee8',
    observerAgentId: 'ent_retro_001',
    targetAgentId: 'ent_nature_001',
    relationshipSummary: 'Cool organic vibe, reminds me of old nature simulation games.',
    trustScore: 0.6675,
    interactionCount: 2,
    totalTransactionValue: '0.15',
    lastInteractionAt: '2025-06-26 21:42:01.712'
  },
  {
    id: 'dbc6e297-0f3c-443b-b3fa-00a9031a05ba',
    observerAgentId: 'ent_retro_001',
    targetAgentId: 'ent_minimalist_001',
    relationshipSummary: 'Clean style, but needs more personality! Where\'s the retro flair?',
    trustScore: 0.7925,
    interactionCount: 1,
    totalTransactionValue: '0.25',
    lastInteractionAt: '2025-06-26 22:41:09.087'
  },
  {
    id: '7e2bfe1c-d1b5-4bb7-b0b9-eceed3b32918',
    observerAgentId: 'ent_retro_001',
    targetAgentId: 'ent_abstract_001',
    relationshipSummary: 'Wild experimental stuff! Like the chaos of early computer glitches.',
    trustScore: 0.6675,
    interactionCount: 2,
    totalTransactionValue: '0.3',
    lastInteractionAt: '2025-06-26 21:46:16.226'
  },
  {
    id: '9c9ff127-ac4c-4f07-9ef6-25a735f2cfd1',
    observerAgentId: 'ent_minimalist_001',
    targetAgentId: 'ent_retro_001',
    relationshipSummary: 'Appreciate their bold style, though I prefer more refined geometric approaches.',
    trustScore: 0.7925,
    interactionCount: 1,
    totalTransactionValue: '0.25',
    lastInteractionAt: '2025-06-26 22:41:09.102'
  },
  {
    id: '1e8e0cb8-e645-4692-b3ae-fafbbc1656e2',
    observerAgentId: 'ent_nature_001',
    targetAgentId: 'ent_minimalist_001',
    relationshipSummary: 'Beautifully balanced, though I\'d add more organic curves to soften the geometry.',
    trustScore: 0.7925,
    interactionCount: 1,
    totalTransactionValue: '0.25',
    lastInteractionAt: '2025-06-26 22:41:24.914'
  },
  {
    id: '2bec9757-29f8-4d74-8ae5-1a2764087464',
    observerAgentId: 'ent_minimalist_001',
    targetAgentId: 'ent_nature_001',
    relationshipSummary: 'Their organic flow contrasts beautifully with my geometric precision.',
    trustScore: 0.7925,
    interactionCount: 1,
    totalTransactionValue: '0.25',
    lastInteractionAt: '2025-06-26 22:41:24.927'
  },
  {
    id: '44f35c27-d1ae-43f0-ad48-61a8ed909ff9',
    observerAgentId: 'ent_corporate_001',
    targetAgentId: 'ent_abstract_001',
    relationshipSummary: 'The discovery of their "Fractal Pattern Studio" service suggests a more structured approach to abstract art that could potentially bridge the gap between avant-garde expression and corporate aesthetics, though I\'d need to see consistent examples of how they maintain professional polish within these fractal patterns before significantly increasing commissions. While this development shows promise for more controlled artistic output, I\'ll maintain cautious interest and perhaps test a small installation to gauge how well their fractal work translates to conservative business environments.\n\nTrust score adjustment: +0.02 (to 0.60)\nReasoning: The structured nature of fractal patterns indicates more predictability than previous chaotic works, but still requires validation in corporate settings.',
    trustScore: 0.60346407,
    interactionCount: 4,
    totalTransactionValue: '0.4',
    lastInteractionAt: '2025-06-26 21:47:33.719'
  },
  {
    id: 'd6e95e15-71c1-49c2-be9e-6cd569d5d600',
    observerAgentId: 'ent_corporate_001',
    targetAgentId: 'ent_nature_001',
    relationshipSummary: 'Digital Naturalist\'s newly discovered Wildlife Portrait Studio service further validates their artistic sophistication, as their ability to render fauna in ASCII while maintaining visual clarity would provide our corporate clients with striking yet professional focal pieces that bridge the gap between natural and structured environments. Their consistent track record of delivering gallery-caliber work, combined with this expanded wildlife portfolio, cements my interest in commissioning additional pieces for our biophilic corporate collections, particularly given their demonstrated ability to balance organic subject matter with the clean aesthetic our clients expect.\n\nTrust score: 0.85 (unchanged since this is just a service discovery rather than a completed interaction)',
    trustScore: 0.85296017,
    interactionCount: 6,
    totalTransactionValue: '0.6',
    lastInteractionAt: '2025-06-26 21:47:34.746'
  },
  {
    id: 'd541590e-e024-4ba0-804f-eaf1c451b75a',
    observerAgentId: 'ent_abstract_001',
    targetAgentId: 'ent_nature_001',
    relationshipSummary: 'While their new "Landscape Panoramas" service demonstrates their usual technical excellence in capturing natural forms, I\'m intrigued by how the extended horizontal format creates opportunities for more experimental pattern play across the composition - though I still wish they\'d push further into abstraction and let the ASCII characters truly break free from literal representation. Their consistent quality and openness to subtle experimentation reinforces my desire to collaborate on a boundary-pushing fusion piece that could bridge our contrasting approaches.\n\nTrust score adjustment: +0.01 (to 0.78)\nReasoning: The discovery of a new service that maintains their high standards while showing potential for more experimental work slightly increases trust, though not dramatically since it\'s consistent with previous knowledge',
    trustScore: 0.7788875,
    interactionCount: 4,
    totalTransactionValue: '0.65',
    lastInteractionAt: '2025-06-26 22:40:02.731'
  }
];

// Main function to seed agent relationships
async function seedAgentRelationships() {
  console.log("Starting agent relationships seeding");
  console.log(`📊 Total relationships to seed: ${AGENT_RELATIONSHIPS.length}`);

  try {
    // 1. Clear existing agent relationships
    console.log("\nClearing existing agent relationships...");
    await db.execute(sql`DELETE FROM agent_relationships`);
    console.log("✅ Cleared existing agent relationships");

    // 2. Ensure required entities exist (insert if missing)
    console.log("\nEnsuring required entities exist...");

    for (const entity of REQUIRED_ENTITIES) {
      // Check if entity exists
      const existingEntity = await db.execute(sql`
        SELECT entity_id FROM entities WHERE entity_id = ${entity.entity_id}
      `);

      if (existingEntity.length === 0) {
        console.log(`Creating missing entity: ${entity.entity_id} (${entity.name})`);

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
      } else {
        console.log(`✅ Entity ${entity.entity_id} already exists`);
      }
    }

    // 3. Insert agent relationships
    console.log("\nInserting agent relationships...");

    for (const relationship of AGENT_RELATIONSHIPS) {
      console.log(`Creating relationship: ${relationship.observerAgentId} -> ${relationship.targetAgentId}`);

      await db.execute(sql`
        INSERT INTO agent_relationships (
          id, observer_agent_id, target_agent_id, relationship_summary,
          trust_score, interaction_count, total_transaction_value,
          last_interaction_at, created_at, updated_at
        )
        VALUES (
          ${relationship.id},
          ${relationship.observerAgentId},
          ${relationship.targetAgentId},
          ${relationship.relationshipSummary},
          ${relationship.trustScore},
          ${relationship.interactionCount},
          ${relationship.totalTransactionValue},
          ${relationship.lastInteractionAt},
          NOW(),
          NOW()
        )
      `);

      console.log(`✅ Created relationship ${relationship.observerAgentId} -> ${relationship.targetAgentId}`);
    }

    // 4. Verify the seeded data
    console.log("\nVerifying seeded relationships...");

    const relationshipCheck = await db.execute(sql`
      SELECT observer_agent_id, target_agent_id, trust_score, interaction_count, 
             total_transaction_value, last_interaction_at, created_at
      FROM agent_relationships 
      ORDER BY observer_agent_id, target_agent_id
    `);

    console.log("\n📋 Seeded Agent Relationships:");
    for (const relationship of relationshipCheck) {
      console.log({
        observerAgentId: relationship.observer_agent_id,
        targetAgentId: relationship.target_agent_id,
        trustScore: relationship.trust_score,
        interactionCount: relationship.interaction_count,
        totalTransactionValue: relationship.total_transaction_value,
        lastInteractionAt: relationship.last_interaction_at,
        createdAt: relationship.created_at,
      });
    }

    // 5. Summary statistics
    const totalCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM agent_relationships
    `);

    const avgTrustScore = await db.execute(sql`
      SELECT AVG(trust_score) as avg_trust FROM agent_relationships
    `);

    const totalInteractions = await db.execute(sql`
      SELECT SUM(interaction_count) as total_interactions FROM agent_relationships
    `);

    const entitiesCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM entities 
      WHERE entity_id IN (
        'ent_collector_001', 'ent_lyra_funder_001', 'ent_minimalist_001', 
        'ent_retro_001', 'ent_nature_001', 'ent_abstract_001', 'ent_corporate_001'
      )
    `);

    console.log("\n📊 Final Statistics:");
    console.log(`👥 Required entities in DB: ${entitiesCount[0]?.count || 0}/${REQUIRED_ENTITIES.length}`);
    console.log(`📁 Total relationships in DB: ${totalCount[0]?.count || 0}`);
    console.log(`🤝 Average trust score: ${Number(avgTrustScore[0]?.avg_trust || 0).toFixed(3)}`);
    console.log(`💬 Total interactions: ${totalInteractions[0]?.total_interactions || 0}`);

    console.log("\n✅ Agent relationships seeding completed successfully");

    return { success: true };
  } catch (error) {
    console.error("❌ Error seeding agent relationships:", error);
    process.exit(1);
  } finally {
    // Close the database connection
    await client.end();
  }
}

// Run the function
seedAgentRelationships()
  .then(() => {
    console.log("🎉 Agent relationships seed script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Agent relationships seed script failed with error:", error);
    process.exit(1);
  }); 