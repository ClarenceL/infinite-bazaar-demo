#!/usr/bin/env tsx

/**
 * Test script for x402 integration between opus-genesis-id (server) and opus-nitro-sdk-mock (client)
 *
 * This script:
 * 1. Tests the service info endpoint (no payment required)
 * 2. Tests claim submission with x402 payment
 * 3. Demonstrates the full x402 payment flow
 */

import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { decodeXPaymentResponse, wrapFetchWithPayment } from "x402-fetch";

// Configuration
const OPUS_GENESIS_ID_URL = process.env.OPUS_GENESIS_ID_URL || "http://localhost:3106";
const PRIVATE_KEY = process.env.X402_PRIVATE_KEY as Hex;

// Sample data
const SAMPLE_CLAIM = {
  did: "did:iden3:polygon:amoy:x3HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ2H2",
  claimType: "identity_verification",
  claimData: {
    verified: true,
    verificationMethod: "enclave_attestation",
    timestamp: new Date().toISOString(),
    source: "test-script",
  },
  issuer: "did:iden3:polygon:amoy:x1HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ1H1",
  subject: "did:iden3:polygon:amoy:x3HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ2H2",
};

async function testServiceInfo() {
  console.log("🔍 Testing service info endpoint (no payment required)...");

  try {
    const response = await fetch(`${OPUS_GENESIS_ID_URL}/genesis/info`);
    const data = await response.json();

    console.log("✅ Service info retrieved successfully:");
    console.log(JSON.stringify(data, null, 2));

    return data;
  } catch (error) {
    console.error("❌ Failed to get service info:", error);
    throw error;
  }
}

async function testX402ClaimSubmission() {
  console.log("💳 Testing claim submission with x402 payment...");

  if (!PRIVATE_KEY) {
    throw new Error("X402_PRIVATE_KEY environment variable is required");
  }

  try {
    // Create x402-enabled fetch client
    const account = privateKeyToAccount(PRIVATE_KEY);
    const fetchWithPayment = wrapFetchWithPayment(fetch, account);

    console.log(`📝 Using account: ${account.address}`);
    console.log("💰 Submitting claim with automatic x402 payment...");

    // Submit claim with automatic payment
    const response = await fetchWithPayment(`${OPUS_GENESIS_ID_URL}/genesis/claim/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(SAMPLE_CLAIM),
    });

    const data = await response.json();

    // Extract payment details from response headers
    let paymentDetails = null;
    const paymentResponseHeader = response.headers.get("x-payment-response");
    if (paymentResponseHeader) {
      try {
        paymentDetails = decodeXPaymentResponse(paymentResponseHeader);
        console.log("💳 Payment details:", paymentDetails);
      } catch (error) {
        console.warn("⚠️ Failed to decode payment response header:", error);
      }
    }

    if (response.ok) {
      console.log("✅ Claim submitted successfully with x402 payment:");
      console.log(JSON.stringify(data, null, 2));

      if (paymentDetails) {
        console.log("💰 Payment processed:");
        console.log(JSON.stringify(paymentDetails, null, 2));
      }
    } else {
      console.error("❌ Claim submission failed:");
      console.error(JSON.stringify(data, null, 2));
    }

    return { data, paymentDetails };
  } catch (error) {
    console.error("❌ Failed to submit claim with x402 payment:", error);
    throw error;
  }
}

async function main() {
  console.log("🚀 Starting x402 integration test...");
  console.log(`📡 Server URL: ${OPUS_GENESIS_ID_URL}`);

  try {
    // Test 1: Service info (no payment)
    const serviceInfo = await testServiceInfo();

    console.log("\n" + "=".repeat(50) + "\n");

    // Test 2: Claim submission with x402 payment
    if (serviceInfo.x402Enabled) {
      console.log("✅ x402 is enabled on the server");
      await testX402ClaimSubmission();
    } else {
      console.log(
        "⚠️ x402 is not enabled on the server (X402_SERVICE_WALLET_ADDRESS not configured)",
      );
      console.log("🔧 To enable x402, set X402_SERVICE_WALLET_ADDRESS environment variable");
    }

    console.log("\n🎉 x402 integration test completed successfully!");
  } catch (error) {
    console.error("\n💥 x402 integration test failed:", error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);
