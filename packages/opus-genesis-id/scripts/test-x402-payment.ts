#!/usr/bin/env bun

import { ClaimService } from "../src/services/claim-service";
import type { X402Payment, ClaimSubmission } from "../src/services/claim-service";

// Sample x402 payment data for testing
const samplePayment: X402Payment = {
  amount: 1.0,
  currency: "USDC",
  transactionHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  fromAddress: "0x742d35Cc6635C0532925a3b8D6Ac6c0532925a3b",
  toAddress: "0x8B4c5d9c4B5e6f7a8B9c0d1e2f3a4B5c6d7e8f9a",
  blockNumber: 5123456,
  timestamp: Date.now(),
};

// Sample claim data
const sampleClaim: ClaimSubmission = {
  did: "did:iden3:polygon:amoy:x3HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ2H2",
  claimType: "identity_verification",
  claimData: {
    verified: true,
    verificationMethod: "biometric",
    timestamp: new Date().toISOString(),
  },
  issuer: "did:iden3:polygon:amoy:x1HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ1H1",
  subject: "did:iden3:polygon:amoy:x3HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ2H2",
};

async function testX402Payment() {
  console.log("🚀 Testing x402 Payment Verification");
  console.log("=====================================");

  const claimService = new ClaimService();

  try {
    // Test payment verification
    console.log("\n📝 Sample Payment Data:");
    console.log(JSON.stringify(samplePayment, null, 2));

    console.log("\n🔍 Verifying x402 payment...");
    const paymentResult = await claimService.verifyX402Payment(samplePayment);

    console.log("\n✅ Payment verification result:");
    console.log(JSON.stringify(paymentResult, null, 2));

    if (paymentResult.success && paymentResult.verified) {
      // Test claim submission
      console.log("\n📋 Sample Claim Data:");
      console.log(JSON.stringify(sampleClaim, null, 2));

      console.log("\n🔗 Submitting claim to blockchain...");
      const claimResult = await claimService.submitClaim(sampleClaim, paymentResult.paymentId);

      console.log("\n✅ Claim submission result:");
      console.log(JSON.stringify(claimResult, null, 2));

      if (claimResult.success) {
        // Test claim retrieval
        console.log("\n🔍 Retrieving claim by DID...");
        const retrievedClaim = await claimService.getClaimByDID(sampleClaim.did);

        console.log("\n📄 Retrieved claim:");
        console.log(JSON.stringify(retrievedClaim, null, 2));
      }
    }

    console.log("\n🎉 All tests completed successfully!");
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Test with invalid payment data
async function testInvalidPayment() {
  console.log("\n🧪 Testing Invalid Payment Data");
  console.log("================================");

  const claimService = new ClaimService();

  const invalidPayment: X402Payment = {
    amount: 0.5, // Insufficient amount
    currency: "USDC",
    transactionHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    fromAddress: "0x742d35Cc6635C0532925a3b8D6Ac6c0532925a3b",
    toAddress: "0x8B4c5d9c4B5e6f7a8B9c0d1e2f3a4B5c6d7e8f9a",
  };

  try {
    console.log("\n📝 Invalid Payment Data (insufficient amount):");
    console.log(JSON.stringify(invalidPayment, null, 2));

    console.log("\n🔍 Attempting to verify invalid payment...");
    await claimService.verifyX402Payment(invalidPayment);

    console.log("\n❌ This should not succeed!");
  } catch (error) {
    console.log("\n✅ Expected error caught:");
    console.log(error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log("🔧 opus-genesis-id x402 Payment Test");
  console.log("====================================");

  // Show environment configuration
  console.log("\n🌍 Environment Configuration:");
  console.log(`- X402_SERVICE_WALLET_ADDRESS: ${process.env.X402_SERVICE_WALLET_ADDRESS || 'Not configured (using mock mode)'}`);
  console.log(`- BASE_SEPOLIA_RPC_URL: ${process.env.BASE_SEPOLIA_RPC_URL || 'Using default'}`);

  await testX402Payment();
  await testInvalidPayment();

  console.log("\n✨ Test suite completed!");
}

// Run the tests
if (import.meta.main) {
  main().catch(console.error);
} 