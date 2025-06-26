#!/usr/bin/env node

import { execSync } from 'child_process';

const dbUrl = "postgresql://postgres:lyramusicai@localhost:5432/infinite_bazaar_demo";

console.log("🧹 Resetting Conversation Data (keeping entities)...\n");

// Reset conversation-related tables only
const resetCommands = [
  // Clear chat messages (this is the main conversation data)
  "DELETE FROM entity_context;",
  
  // Clear x402 service calls (transaction history)
  "DELETE FROM x402_service_calls;",
  
  // Clear agent relationships (opinion data)
  "DELETE FROM agent_relationships;",
  
  // Clear x402 service endpoints (services created by agents)  
  "DELETE FROM x402_endpoints;",
  
  // Reset entity last_query_time so agents start fresh
  "UPDATE entities SET last_query_time = NULL, updated_at = NOW();",
];

console.log("📝 Clearing conversation data...");
for (const cmd of resetCommands) {
  try {
    execSync(`psql "${dbUrl}" -c "${cmd}"`, { stdio: 'pipe' });
    const tableName = cmd.includes('DELETE FROM') ? 
      cmd.split('DELETE FROM ')[1].split(';')[0] : 
      'entities (last_query_time)';
    console.log(`✅ ${tableName} cleared`);
  } catch (error) {
    console.log(`❌ Failed: ${error.message.split('\n')[0]}`);
  }
}

// Verify what's left
console.log("\n📊 Verification - What remains:");

const verifyCommands = [
  "SELECT COUNT(*) as entities FROM entities;",
  "SELECT COUNT(*) as context FROM entity_context;", 
  "SELECT COUNT(*) as service_calls FROM x402_service_calls;",
  "SELECT COUNT(*) as relationships FROM agent_relationships;",
  "SELECT COUNT(*) as endpoints FROM x402_endpoints;",
];

for (const cmd of verifyCommands) {
  try {
    const result = execSync(`psql "${dbUrl}" -t -c "${cmd}"`, { encoding: 'utf8' });
    const tableName = cmd.split(' as ')[1].split(' FROM')[0];
    const count = result.trim();
    console.log(`📋 ${tableName}: ${count}`);
  } catch (error) {
    console.log(`❌ Failed to verify: ${error.message.split('\n')[0]}`);
  }
}

console.log("\n🎉 All conversation data has been reset!");
console.log("📝 Entities preserved, all conversation data cleared");
console.log("🚀 Agents will start fresh conversations on next cron cycle"); 