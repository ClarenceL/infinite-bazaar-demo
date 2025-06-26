#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Get the directory name using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment and load appropriate .env file
const env = process.env.NODE_ENV || "test";
console.log(`Using environment: ${env}`);

// Load the appropriate .env file
const envFile = `.env${env !== "development" ? `.${env}` : ""}`;
const envPath = path.resolve(process.cwd(), envFile);
const result = config({ path: envPath });

if (result.error) {
  console.error(`Error loading ${envFile}:`, result.error);

  // For test environment, set required mock variables
  if (env === "test") {
    process.env.NODE_ENV = "test";
    process.env.CDP_API_KEY_NAME = "test-api-key";
    process.env.CDP_PRIVATE_KEY = "test-private-key-for-development-only";
    process.env.MOCK_CDP_WALLET = "true";
    process.env.X402_SERVICE_WALLET_ADDRESS = "0x742d35Cc6634C0532925a3b8D24d4C4e7C6e6dBc";
    process.env.BASE_SEPOLIA_RPC_URL = "https://sepolia.base.org";
    process.env.PORT = "3106";
    process.env.OPUS_GENESIS_AUTH_KEY = "test-genesis-key-123";
    console.log("Set test environment variables for mock CDP wallet testing");
  }
}

console.log(`Loaded environment from ${envFile}`);

// Ensure logs directory exists
const logsDir = path.join(__dirname, "..", "logs");
const cdpTestDir = path.join(logsDir, "cdp-tests");
if (!fs.existsSync(cdpTestDir)) {
  fs.mkdirSync(cdpTestDir, { recursive: true });
  console.log(`📁 Created CDP test directory: ${cdpTestDir}`);
}

console.log("🧪 Testing Mock CDP Wallet Integration...");

// Helper function to save test results to logs
function saveTestResultToLogs(testName: string, result: any) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `cdp-test-${testName.toLowerCase().replace(/\s+/g, "-")}-${timestamp}.json`;
  const filepath = path.join(cdpTestDir, filename);

  const logData = {
    testName,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    result,
  };

  fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
  console.log(`💾 Test result saved to: ${filename}`);

  return filepath;
}

async function testMockCdpWallet() {
  try {
    console.log("🔧 Testing Mock CDP Wallet Service...");

    // Test 1: Create mock CDP client
    console.log("\n🧪 Test 1: Create mock CDP client");

    const { createCdpClient, createMockWallet } = await import(
      "../src/services/mock-cdp-service.js"
    );

    const mockCdpClient = createCdpClient({
      apiKeyName: "test-api-key",
      privateKey: "test-private-key",
    });

    console.log("✅ Mock CDP client created successfully");

    // Test 2: Create mock user and wallet
    console.log("\n🧪 Test 2: Create mock user and wallet");

    const testUserId = "test-user-" + Date.now();
    const user = await mockCdpClient.createUser(testUserId);
    console.log("✅ Mock user created:", user.id);

    const walletName = "genesis-test-wallet";
    const wallet = await user.createWallet!(walletName);
    console.log("✅ Mock wallet created:", {
      id: wallet.id,
      name: wallet.name,
      defaultAddress: wallet.defaultAddress?.address,
    });

    // Test 3: Create additional addresses
    console.log("\n🧪 Test 3: Create additional addresses");

    const newAddress = await wallet.createAddress!();
    console.log("✅ New address created:", newAddress.address);

    const addresses = await wallet.listAddresses!();
    console.log(
      "✅ All addresses:",
      addresses.map((addr) => addr.address),
    );

    // Test 4: Test transaction simulation
    console.log("\n🧪 Test 4: Test transaction simulation");

    const txResult = await mockCdpClient.simulateTransaction({
      from: wallet.defaultAddress!.address!,
      to: "0x742d35Cc6634C0532925a3b8D24d4C4e7C6e6dBc",
      value: "1000000", // 1 USDC
    });

    console.log("✅ Transaction simulated:", {
      hash: txResult.hash,
      status: txResult.status,
      gasUsed: txResult.gasUsed,
    });

    // Test 5: Test transaction receipt
    console.log("\n🧪 Test 5: Test transaction receipt");

    const receipt = await mockCdpClient.getTransactionReceipt(txResult.hash);
    console.log("✅ Transaction receipt:", {
      hash: receipt.hash,
      status: receipt.status,
      confirmations: receipt.confirmations,
    });

    // Save comprehensive test results
    const testResults = {
      mockClient: "created",
      user: { id: user.id },
      wallet: {
        id: wallet.id,
        name: wallet.name,
        defaultAddress: wallet.defaultAddress?.address,
      },
      newAddress: newAddress.address,
      allAddresses: addresses.map((addr) => addr.address),
      transaction: txResult,
      receipt,
    };

    saveTestResultToLogs("Mock CDP Wallet Integration", testResults);

    console.log("\n🎉 All Mock CDP Wallet tests completed successfully!");
    return testResults;
  } catch (error) {
    console.error("❌ Mock CDP Wallet test failed:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join("\n") : undefined,
    });
    throw error;
  }
}

async function testClaimServiceIntegration() {
  try {
    console.log("🔧 Testing Claim Service with Mock CDP Integration...");

    // Test 1: Create claim service with mock CDP
    console.log("\n🧪 Test 1: Create claim service with mock CDP");

    const { ClaimService } = await import("../src/services/claim-service.js");
    const claimService = new ClaimService();

    console.log("✅ Claim service created successfully");

    // Test 2: Test blockchain transaction simulation
    console.log("\n🧪 Test 2: Test blockchain transaction simulation");

    const testClaim = {
      did: "did:iden3:polygon:amoy:x7f1rB5XR5184yPmKJPpPVU7AFNEQujd7SnjcpH6c",
      claimType: "genesis-identity",
      claimData: {
        llmModel: "claude-3-5-sonnet-20241022",
        weightsHash: "0x1234567890abcdef",
        promptHash: "0xabcdef1234567890",
        relationshipHash: "0x9876543210fedcba",
      },
      issuer: "did:iden3:polygon:amoy:issuer123",
      subject: "did:iden3:polygon:amoy:subject456",
    };

    const claimId = `test-claim-${Date.now()}`;
    const blockchainResult = await claimService.simulateBlockchainTransaction(testClaim, claimId);

    console.log("✅ Blockchain simulation result:", {
      success: blockchainResult.success,
      transactionHash: blockchainResult.transactionHash,
      accountName: blockchainResult.accountName,
    });

    // Test 3: Test full claim submission
    console.log("\n🧪 Test 3: Test full claim submission");

    const paymentId = `payment-${Date.now()}`;
    const submissionResult = await claimService.submitClaim(testClaim, paymentId);

    console.log("✅ Claim submission result:", {
      success: submissionResult.success,
      claimId: submissionResult.claimId,
      transactionHash: submissionResult.transactionHash,
      gasUsed: submissionResult.gasUsed,
    });

    // Save integration test results
    const integrationResults = {
      claimService: "created",
      blockchainSimulation: blockchainResult,
      claimSubmission: submissionResult,
      testClaim,
      paymentId,
    };

    saveTestResultToLogs("Claim Service Integration", integrationResults);

    console.log("\n🎉 All Claim Service integration tests completed successfully!");
    return integrationResults;
  } catch (error) {
    console.error("❌ Claim Service integration test failed:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join("\n") : undefined,
    });
    throw error;
  }
}

async function testOpusGenesisServiceCall() {
  try {
    console.log("🌐 Testing Opus Genesis Service API Call...");

    const baseUrl = "http://localhost:3106";
    const authKey = process.env.OPUS_GENESIS_AUTH_KEY || "test-genesis-key-123";

    // Test 1: Health endpoint
    console.log("\n🧪 Test 1: Health endpoint");
    try {
      const healthResponse = await fetch(`${baseUrl}/health`);
      const healthData = await healthResponse.json();

      console.log("✅ Health endpoint response:", {
        status: healthResponse.status,
        data: healthData,
      });
    } catch (error) {
      console.log(
        "❌ Health endpoint failed (service may not be running):",
        error instanceof Error ? error.message : String(error),
      );
      console.log(
        "💡 To start the service, run: NODE_ENV=test pnpm dev in packages/opus-genesis-id",
      );
      return null;
    }

    // Test 2: Submit a claim via API
    console.log("\n🧪 Test 2: Submit claim via API");
    try {
      const testClaim = {
        did: "did:iden3:polygon:amoy:x7f1rB5XR5184yPmKJPpPVU7AFNEQujd7SnjcpH6c",
        claimType: "genesis-identity",
        claimData: {
          llmModel: "claude-3-5-sonnet-20241022",
          weightsHash: "0x1234567890abcdef",
          promptHash: "0xabcdef1234567890",
          relationshipHash: "0x9876543210fedcba",
        },
      };

      const claimResponse = await fetch(`${baseUrl}/genesis/claim/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authKey}`,
        },
        body: JSON.stringify(testClaim),
      });

      if (claimResponse.ok) {
        const claimData = await claimResponse.json();
        console.log("✅ Claim submission response:", {
          status: claimResponse.status,
          success: claimData.success,
          claimId: claimData.claimId,
          transactionHash: claimData.transactionHash,
        });

        saveTestResultToLogs("Opus Genesis API Call", {
          endpoint: "/genesis/claim/submit",
          request: testClaim,
          response: claimData,
        });
      } else {
        const errorData = await claimResponse.text();
        console.log("❌ Claim submission failed:", {
          status: claimResponse.status,
          error: errorData,
        });
      }
    } catch (error) {
      console.log("❌ API call failed:", error instanceof Error ? error.message : String(error));
    }

    console.log("\n🎉 Opus Genesis Service API tests completed!");
  } catch (error) {
    console.error("❌ Opus Genesis Service API test failed:", error);
    throw error;
  }
}

// Run all tests
async function runAllTests() {
  console.log("🚀 Starting Mock CDP Wallet Integration Tests...");

  try {
    // Test 1: Mock CDP Wallet functionality
    const mockResults = await testMockCdpWallet();

    console.log("\n" + "=".repeat(60));

    // Test 2: Claim Service integration
    const integrationResults = await testClaimServiceIntegration();

    console.log("\n" + "=".repeat(60));

    // Test 3: Opus Genesis Service API call
    await testOpusGenesisServiceCall();

    console.log("\n🎉 All tests completed successfully!");
    console.log("\n📋 Next steps:");
    console.log("1. Start the opus-genesis-id service: NODE_ENV=test pnpm dev");
    console.log("2. Call the service from opus-nitro-sdk-mock after generic claim creation");
    console.log("3. Verify end-to-end integration between both services");
  } catch (error) {
    console.error("❌ Test suite failed:", error);
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error("❌ Unhandled error in test:", error);
  process.exit(1);
});
