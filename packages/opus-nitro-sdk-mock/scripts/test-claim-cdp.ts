#!/usr/bin/env bun

/**
 * Test script for Coinbase CDP claim handler
 *
 * This script tests the claim-cdp tool which uses Coinbase CDP SDK
 * instead of private keys for x402 payments.
 */

import { logger } from "@infinite-bazaar-demo/logs";
import { handleClaimCdp } from "../src/agents/tools/handlers/claim-cdp/index";

interface TestResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  timestamp: string;
}

async function testClaimCdp(): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    success: false,
    duration: 0,
    timestamp: new Date().toISOString(),
  };

  try {
    logger.info("🚀 Testing CDP Claim Handler");

    // Check required environment variables
    const requiredEnvVars = [
      "CDP_API_KEY_ID",
      "CDP_API_KEY_SECRET",
      "CDP_WALLET_SECRET",
      "OPUS_GENESIS_ID_URL",
    ];

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      const errorMsg = `Missing required environment variables: ${missingVars.join(", ")}`;
      logger.error(errorMsg);
      result.error = errorMsg;
      return result;
    }

    logger.info("✅ All required environment variables are set");

    // Test the CDP claim handler
    logger.info("🔄 Testing handleClaimCdp function...");
    const claimResult = await handleClaimCdp();

    if (claimResult.data?.success) {
      logger.info("✅ CDP claim handler test passed");
      result.success = true;
      result.data = claimResult.data;
    } else {
      logger.error({ claimResult }, "❌ CDP claim handler test failed");
      result.error = claimResult.data?.error || "Unknown error from claim handler";
      result.data = claimResult.data;
    }
  } catch (error) {
    logger.error({ error }, "❌ Test execution failed");
    result.error = error instanceof Error ? error.message : "Unknown error";
  } finally {
    result.duration = Date.now() - startTime;
  }

  return result;
}

function generateTestReport(result: TestResult): void {
  console.log("\n" + "=".repeat(80));
  console.log("🧪 COINBASE CDP CLAIM HANDLER TEST REPORT");
  console.log("=".repeat(80));

  console.log(`📅 Timestamp: ${result.timestamp}`);
  console.log(`⏱️  Duration: ${result.duration}ms`);
  console.log(`✅ Success: ${result.success ? "PASS" : "FAIL"}`);

  if (result.success && result.data) {
    console.log("\n🎉 TEST PASSED - CDP Claim Handler Results:");
    console.log(`  Message: ${result.data.message}`);

    if (result.data.cdpAccount) {
      console.log(`  CDP Account Name: ${result.data.cdpAccount.name}`);
      console.log(`  CDP Account ID: ${result.data.cdpAccount.id}`);
      console.log(`  CDP Account Address: ${result.data.cdpAccount.address}`);
    }

    if (result.data.paymentDetails) {
      console.log(`  Payment Method: ${result.data.paymentDetails.method || "x402-cdp"}`);
      console.log(`  Payment Status: ${result.data.paymentDetails.status || "processed"}`);
    }

    if (result.data.claimSubmission) {
      console.log(`  Claim ID: ${result.data.claimSubmission.claimId || "N/A"}`);
      console.log(`  Payment Verified: ${result.data.claimSubmission.paymentVerified || false}`);
    }
  }

  if (result.error) {
    console.log("\n❌ TEST FAILED:");
    console.log(`  Error: ${result.error}`);

    if (result.data?.details) {
      console.log(`  Details: ${result.data.details}`);
    }
  }

  console.log("\n" + "=".repeat(80));

  if (result.success) {
    console.log("🎉 CDP CLAIM HANDLER TEST SUCCESSFUL!");
    console.log("✅ Coinbase CDP SDK integration is working");
    console.log("✅ x402 payment with CDP accounts is functional");
    console.log("✅ Claim submission flow completed successfully");
  } else {
    console.log("❌ CDP CLAIM HANDLER TEST FAILED!");
    console.log("Please check:");
    console.log("  1. CDP environment variables are correctly set");
    console.log("  2. opus-genesis-id service is running on port 3106");
    console.log("  3. CDP API credentials are valid");
    console.log("  4. Network connectivity to CDP services");
  }

  console.log("=".repeat(80) + "\n");
}

// Main execution
async function main() {
  console.log("Starting Coinbase CDP Claim Handler Test...\n");

  const result = await testClaimCdp();
  generateTestReport(result);

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Handle uncaught errors
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled Rejection in CDP test");
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught Exception in CDP test");
  process.exit(1);
});

// Run the script if executed directly
if (process.argv[1] === import.meta.url.replace("file://", "")) {
  main().catch((error) => {
    logger.error({ error }, "Failed to run CDP claim test");
    process.exit(1);
  });
}
