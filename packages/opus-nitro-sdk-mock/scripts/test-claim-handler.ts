#!/usr/bin/env bun

import { handleClaim } from "../src/agents/tools/handlers/claim/index.js";

async function testClaimHandler() {
  console.log("🧪 Testing handleClaim function");
  console.log("=================================");

  try {
    console.log("\n🔄 Calling handleClaim...");
    const result = await handleClaim();

    console.log("\n✅ handleClaim result:");
    console.log(JSON.stringify(result, null, 2));

    if (result.data?.success) {
      console.log("\n🎉 Claim submission successful!");
      console.log(`Transaction Hash: ${result.data.paymentDetails?.transactionHash}`);
      console.log(`Claim ID: ${result.data.claimSubmission?.claimId}`);
      console.log(`Payment ID: ${result.data.claimSubmission?.paymentId}`);
    } else {
      console.log("\n❌ Claim submission failed:");
      console.log(`Error: ${result.data?.error}`);
      console.log(`Details: ${result.data?.details}`);
    }
  } catch (error) {
    console.error("\n💥 Test failed with error:");
    console.error(error);
    process.exit(1);
  }
}

// Run the test
if (import.meta.main) {
  testClaimHandler().catch(console.error);
}
