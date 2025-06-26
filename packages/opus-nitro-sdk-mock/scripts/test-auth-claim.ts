#!/usr/bin/env bun

import { logger } from "@infinite-bazaar-demo/logs";
import { Iden3AuthClaimService } from "../src/services/iden3-auth-claim-service.js";

const TEST_AGENT_ID = "test-agent-auth-claim-" + Date.now();

async function testAuthClaimCreation(): Promise<void> {
  try {
    logger.info("🔑 Testing proper Iden3 AuthClaim creation...");

    // Step 1: Initialize the service
    const authClaimService = new Iden3AuthClaimService();
    logger.info("✅ Initialized Iden3AuthClaimService");

    // Step 2: Create AuthClaim with proper tree structure
    logger.info({ agentId: TEST_AGENT_ID }, "Creating AuthClaim with trees...");
    const identityWithTrees = await authClaimService.createAuthClaimWithTrees(TEST_AGENT_ID);

    logger.info(
      {
        identityState: identityWithTrees.identityState,
        claimsTreeRoot: identityWithTrees.authClaimResult.claimsTreeRoot,
        revocationTreeRoot: identityWithTrees.authClaimResult.revocationTreeRoot,
        rootsTreeRoot: identityWithTrees.authClaimResult.rootsTreeRoot,
      },
      "✅ AuthClaim and trees created successfully",
    );

    // Step 3: Verify the AuthClaim
    logger.info("Verifying AuthClaim...");
    const isValid = await authClaimService.verifyAuthClaim(identityWithTrees, TEST_AGENT_ID);

    if (isValid) {
      logger.info("✅ AuthClaim verification successful");
    } else {
      logger.error("❌ AuthClaim verification failed");
      process.exit(1);
    }

    // Step 4: Display results
    console.log("\n🎉 AuthClaim Creation Test Results:");
    console.log("=====================================");
    console.log(`Agent ID: ${TEST_AGENT_ID}`);
    console.log(`Identity State: ${identityWithTrees.identityState}`);
    console.log(`Claims Tree Root: ${identityWithTrees.authClaimResult.claimsTreeRoot}`);
    console.log(`Revocation Tree Root: ${identityWithTrees.authClaimResult.revocationTreeRoot}`);
    console.log(`Roots Tree Root: ${identityWithTrees.authClaimResult.rootsTreeRoot}`);
    console.log(`Auth Claim hIndex: ${identityWithTrees.authClaimResult.hIndex}`);
    console.log(`Auth Claim hValue: ${identityWithTrees.authClaimResult.hValue}`);
    console.log(`Public Key X: ${identityWithTrees.authClaimResult.publicKeyX.substring(0, 32)}...`);
    console.log(`Public Key Y: ${identityWithTrees.authClaimResult.publicKeyY.substring(0, 32)}...`);
    console.log(`Verification: ${isValid ? "✅ Valid" : "❌ Invalid"}`);

    console.log("\n📋 Tree Structure Information:");
    console.log("==============================");
    console.log("Following Iden3 documentation pattern:");
    console.log("- Claims Tree: Contains the AuthClaim");
    console.log("- Revocation Tree: Empty (no revocations yet)");
    console.log("- Roots Tree: Empty (no state transitions yet)");
    console.log("- Identity State: Hash of all three tree roots");

    logger.info("🎉 AuthClaim creation test completed successfully");
  } catch (error) {
    logger.error({ error }, "❌ AuthClaim creation test failed");
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  }
}

// Run the test
testAuthClaimCreation(); 