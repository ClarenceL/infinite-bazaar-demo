#!/usr/bin/env tsx

/**
 * Instance-aware reset script for Infinite Bazaar
 * 
 * This script provides instance-isolated data reset capabilities:
 * 1. Reset specific instance data by instance ID
 * 2. Reset all instances (complete database wipe)
 * 3. Preview what will be deleted before executing
 * 4. Safety prompts and confirmation
 * 5. Comprehensive reporting
 * 
 * Tables with instance_id columns that are reset:
 * - entities
 * - chats  
 * - entityContext (entity_context)
 * - x402Endpoints
 * - x402ServiceCalls
 * - agentRelationships
 * - contextSummaries
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as readline from "node:readline/promises";
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

// Load the appropriate .env file from project root
const envFile = `.env${env !== "development" ? `.${env}` : ""}`;
const projectRoot = path.resolve(__dirname, "../../../");
const envPath = path.resolve(projectRoot, envFile);
const result = config({ path: envPath });

if (result.error) {
  console.error(`Error loading ${envFile}:`, result.error);
  process.exit(1);
}

console.log(`Loaded environment from ${envFile}`);
console.log(
  `DATABASE_URL: ${process.env.DATABASE_URL?.replace(/(postgresql:\/\/)([^:]+):([^@]+)@/, "$1$2:****@")}`,
);

// Initialize PostgreSQL client
const client = postgres(process.env.DATABASE_URL!, {
  max: 1,
  idle_timeout: 10,
  prepare: false,
});

const db = drizzle(client);

// Table names with instance_id columns
const INSTANCE_TABLES = [
  'entities',
  'chats', 
  'entity_context',
  'x402_endpoints',
  'x402_service_calls',
  'agent_relationships',
  'context_summaries'
] as const;

interface TableCount {
  tableName: string;
  count: number;
}

interface ResetStats {
  instanceId: string | 'ALL';
  beforeCounts: TableCount[];
  afterCounts: TableCount[];
  deletedCounts: TableCount[];
}

// Parse command line arguments
const args = process.argv.slice(2);
const instanceId = args.find(arg => arg.startsWith('--instance='))?.split('=')[1];
const allInstances = args.includes('--all-instances');
const preview = args.includes('--preview');
const force = args.includes('--force');
const help = args.includes('--help') || args.includes('-h');

async function showUsage() {
  console.log("Instance-Aware Reset Tool for Infinite Bazaar");
  console.log("==============================================");
  console.log("");
  console.log("Usage:");
  console.log("  tsx reset-instance-data.ts [OPTIONS]");
  console.log("");
  console.log("Options:");
  console.log("  --instance=<id>       Reset data for specific instance ID");
  console.log("  --all-instances       Reset ALL instance data (complete wipe)");
  console.log("  --preview             Show what would be deleted without executing");
  console.log("  --force               Skip confirmation prompts");
  console.log("  --help, -h           Show this help message");
  console.log("");
  console.log("Examples:");
  console.log("  tsx reset-instance-data.ts --instance=default --preview");
  console.log("  tsx reset-instance-data.ts --instance=test123");
  console.log("  tsx reset-instance-data.ts --all-instances");
  console.log("  tsx reset-instance-data.ts --all-instances --force");
  console.log("");
  console.log("Safety:");
  console.log("  - Always run with --preview first to see what will be deleted");
  console.log("  - Confirmation prompts are shown unless --force is used");
  console.log("  - Operation cannot be undone once executed");
}

async function getTableCounts(instanceFilter?: string): Promise<TableCount[]> {
  const counts: TableCount[] = [];
  
  for (const tableName of INSTANCE_TABLES) {
    try {
      let query: string;
      if (instanceFilter) {
        query = `SELECT COUNT(*) as count FROM ${tableName} WHERE instance_id = '${instanceFilter}'`;
      } else {
        query = `SELECT COUNT(*) as count FROM ${tableName}`;
      }
      
      const result = await db.execute(sql.raw(query));
      const count = Number(result[0]?.count || 0);
      counts.push({ tableName, count });
    } catch (error) {
      console.warn(`Warning: Could not count ${tableName}:`, error);
      counts.push({ tableName, count: 0 });
    }
  }
  
  return counts;
}

async function listInstances(): Promise<string[]> {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT instance_id 
      FROM entities 
      ORDER BY instance_id
    `);
    return result.map(row => row.instance_id as string);
  } catch (error) {
    console.warn("Could not list instances:", error);
    return [];
  }
}

async function showPreview(instanceFilter?: string) {
  console.log("\n📊 PREVIEW: Data that would be deleted");
  console.log("=====================================");
  
  if (instanceFilter) {
    console.log(`Instance: ${instanceFilter}`);
  } else {
    console.log("Scope: ALL INSTANCES");
  }
  
  const counts = await getTableCounts(instanceFilter);
  const totalRecords = counts.reduce((sum, table) => sum + table.count, 0);
  
  console.log("\nRecords per table:");
  for (const { tableName, count } of counts) {
    if (count > 0) {
      console.log(`  🗑️  ${tableName}: ${count} records`);
    } else {
      console.log(`  ✅ ${tableName}: 0 records (nothing to delete)`);
    }
  }
  
  console.log(`\nTotal records to delete: ${totalRecords}`);
  
  if (totalRecords === 0) {
    console.log("✅ No data to delete for this scope.");
    return false;
  }
  
  return true;
}

async function confirmDeletion(instanceFilter?: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  try {
    console.log("\n⚠️  WARNING: This action cannot be undone!");
    
    if (instanceFilter) {
      console.log(`You are about to DELETE ALL DATA for instance: ${instanceFilter}`);
    } else {
      console.log("You are about to DELETE ALL DATA for ALL INSTANCES");
    }
    
    const answer = await rl.question('\nAre you sure you want to proceed? Type "yes" to confirm: ');
    return answer.toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

async function executeReset(instanceFilter?: string): Promise<ResetStats> {
  console.log("\n🔄 Executing reset operation...");
  
  const beforeCounts = await getTableCounts(instanceFilter);
  const deletedCounts: TableCount[] = [];
  
  // Delete from tables in correct order (respecting foreign key constraints)
  const deletionOrder = [
    'context_summaries',
    'x402_service_calls', 
    'x402_endpoints',
    'agent_relationships',
    'entity_context',
    'chats',
    'entities'
  ];
  
  for (const tableName of deletionOrder) {
    try {
      let deleteQuery: string;
      if (instanceFilter) {
        deleteQuery = `DELETE FROM ${tableName} WHERE instance_id = '${instanceFilter}'`;
      } else {
        deleteQuery = `DELETE FROM ${tableName}`;
      }
      
      console.log(`  🗑️  Deleting from ${tableName}...`);
      const result = await db.execute(sql.raw(deleteQuery));
      const deletedCount = Number(result.count || 0);
      
      deletedCounts.push({ tableName, count: deletedCount });
      console.log(`     ✅ Deleted ${deletedCount} records`);
    } catch (error) {
      console.error(`     ❌ Error deleting from ${tableName}:`, error);
      deletedCounts.push({ tableName, count: 0 });
    }
  }
  
  const afterCounts = await getTableCounts(instanceFilter);
  
  return {
    instanceId: instanceFilter || 'ALL',
    beforeCounts,
    afterCounts, 
    deletedCounts
  };
}

async function showResetSummary(stats: ResetStats) {
  console.log("\n📋 RESET SUMMARY");
  console.log("================");
  console.log(`Instance: ${stats.instanceId}`);
  console.log(`Completed at: ${new Date().toISOString()}`);
  
  console.log("\nDeletion Results:");
  let totalDeleted = 0;
  
  for (const deleted of stats.deletedCounts) {
    if (deleted.count > 0) {
      console.log(`  ✅ ${deleted.tableName}: ${deleted.count} records deleted`);
      totalDeleted += deleted.count;
    }
  }
  
  console.log(`\nTotal records deleted: ${totalDeleted}`);
  
  // Verify cleanup
  console.log("\nVerification (remaining records):");
  for (const after of stats.afterCounts) {
    if (after.count > 0) {
      console.log(`  ⚠️  ${after.tableName}: ${after.count} records remaining`);
    } else {
      console.log(`  ✅ ${after.tableName}: 0 records (clean)`);
    }
  }
  
  const totalRemaining = stats.afterCounts.reduce((sum, table) => sum + table.count, 0);
  if (totalRemaining === 0) {
    console.log("\n🎉 Reset completed successfully - all target data deleted!");
  } else {
    console.log(`\n⚠️  Reset completed with ${totalRemaining} records remaining`);
  }
}

async function main() {
  try {
    if (help) {
      await showUsage();
      process.exit(0);
    }
    
    // Validate arguments
    if (!instanceId && !allInstances) {
      console.error("❌ Error: Must specify either --instance=<id> or --all-instances");
      console.log("\nUse --help for usage information");
      process.exit(1);
    }
    
    if (instanceId && allInstances) {
      console.error("❌ Error: Cannot specify both --instance and --all-instances");
      process.exit(1);
    }
    
    const targetInstance = allInstances ? undefined : instanceId;
    
    // Show available instances for context
    console.log("\n📍 Available instances:");
    const instances = await listInstances();
    if (instances.length > 0) {
      instances.forEach(id => console.log(`  - ${id}`));
    } else {
      console.log("  (No instances found)");
    }
    
    // Always show preview first
    console.log(`\n🔍 Analyzing data for ${targetInstance ? `instance "${targetInstance}"` : "ALL instances"}...`);
    const hasData = await showPreview(targetInstance);
    
    if (!hasData) {
      console.log("Nothing to delete. Exiting.");
      process.exit(0);
    }
    
    if (preview) {
      console.log("\n✅ Preview complete. Run without --preview to execute the reset.");
      process.exit(0);
    }
    
    // Confirmation unless forced
    if (!force) {
      const confirmed = await confirmDeletion(targetInstance);
      if (!confirmed) {
        console.log("❌ Reset cancelled by user.");
        process.exit(0);
      }
    }
    
    // Execute the reset
    const stats = await executeReset(targetInstance);
    await showResetSummary(stats);
    
    console.log("\n✅ Reset operation completed successfully!");
    
  } catch (error) {
    console.error("💥 Reset operation failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the script
main().catch((error) => {
  console.error("💥 Unexpected error:", error);
  process.exit(1);
}); 