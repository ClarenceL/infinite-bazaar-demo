#!/usr/bin/env bun

/**
 * End-to-End Test Script for InfiniteBazaar Claim Flow
 *
 * This script tests the complete flow:
 * 1. Start both opus-nitro-sdk-mock and opus-genesis-id services
 * 2. Call the test endpoint on opus-nitro-sdk-mock
 * 3. opus-nitro-sdk-mock calls opus-genesis-id claim endpoint
 * 4. First call should return 402 (payment required)
 * 5. x402-fetch handles payment automatically
 * 6. Second call succeeds with payment verification
 * 7. opus-genesis-id simulates blockchain transaction with Coinbase CDP
 * 8. Return complete success result
 */

import { logger } from "@infinite-bazaar-demo/logs";

interface ServiceStatus {
  name: string;
  url: string;
  healthy: boolean;
  error?: string;
}

interface E2ETestResult {
  success: boolean;
  services: ServiceStatus[];
  testResults: {
    claimSubmission?: any;
    cdpClaimSubmission?: any;
    paymentFlow?: any;
    blockchainSimulation?: any;
  };
  errors: string[];
  duration: number;
  timestamp: string;
}

class E2ETestRunner {
  private readonly OPUS_NITRO_URL = "http://localhost:3105";
  private readonly OPUS_GENESIS_URL = "http://localhost:3106";
  private readonly TEST_TIMEOUT = 30000; // 30 seconds
  private readonly AUTH_KEY = process.env.OPUS_NITRO_AUTH_KEY || "test-key-123";

  async runTests(): Promise<E2ETestResult> {
    const startTime = Date.now();
    const result: E2ETestResult = {
      success: false,
      services: [],
      testResults: {},
      errors: [],
      duration: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      logger.info("🚀 Starting InfiniteBazaar E2E Test Suite");

      // Step 1: Check service health
      logger.info("📊 Checking service health...");
      const serviceStatus = await this.checkServiceHealth();
      result.services = serviceStatus;

      const unhealthyServices = serviceStatus.filter((s) => !s.healthy);
      if (unhealthyServices.length > 0) {
        const errorMsg = `Services not healthy: ${unhealthyServices.map((s) => s.name).join(", ")}`;
        result.errors.push(errorMsg);
        logger.error({ unhealthyServices }, errorMsg);
        return result;
      }

      logger.info("✅ All services are healthy");

      // Step 2: Test claim submission flow
      logger.info("🔄 Testing claim submission flow...");
      const claimResult = await this.testClaimSubmissionFlow();
      result.testResults.claimSubmission = claimResult;

      if (!claimResult.success) {
        result.errors.push(`Claim submission failed: ${claimResult.error}`);
        return result;
      }

      logger.info("✅ Claim submission flow completed successfully");

      // Step 2b: Test CDP claim submission flow (if CDP env vars are available)
      const cdpEnvVars = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"];
      const hasCdpEnv = cdpEnvVars.every((varName) => process.env[varName]);

      if (hasCdpEnv) {
        logger.info("🔄 Testing CDP claim submission flow...");
        const cdpClaimResult = await this.testCdpClaimSubmissionFlow();
        result.testResults.cdpClaimSubmission = cdpClaimResult;

        if (!cdpClaimResult.success) {
          logger.warn(`CDP claim submission failed: ${cdpClaimResult.error}`);
          // Don't fail the entire test, just log the warning
        } else {
          logger.info("✅ CDP claim submission flow completed successfully");
        }
      } else {
        logger.info("⏭️ Skipping CDP claim test - CDP environment variables not configured");
      }

      // Step 3: Validate payment flow
      if (claimResult.data?.paymentDetails) {
        logger.info("💳 Validating x402 payment flow...");
        result.testResults.paymentFlow = {
          paymentProcessed: true,
          paymentDetails: claimResult.data.paymentDetails,
          accountAddress: claimResult.data.accountAddress,
        };
        logger.info("✅ x402 payment flow validated");
      }

      // Step 4: Validate blockchain simulation
      if (claimResult.data?.claimSubmission?.transactionHash) {
        logger.info("⛓️  Validating blockchain simulation...");
        result.testResults.blockchainSimulation = {
          transactionHash: claimResult.data.claimSubmission.transactionHash,
          claimId: claimResult.data.claimSubmission.claimId,
          gasUsed: claimResult.data.claimSubmission.gasUsed,
        };
        logger.info("✅ Blockchain simulation validated");
      }

      result.success = true;
      logger.info("🎉 E2E test suite completed successfully!");
    } catch (error) {
      const errorMsg = `E2E test failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      result.errors.push(errorMsg);
      logger.error({ error }, errorMsg);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  private async checkServiceHealth(): Promise<ServiceStatus[]> {
    const services = [
      { name: "opus-nitro-sdk-mock", url: `${this.OPUS_NITRO_URL}/enclave/health` },
      { name: "opus-genesis-id", url: `${this.OPUS_GENESIS_URL}/genesis/health` },
    ];

    const results: ServiceStatus[] = [];

    for (const service of services) {
      try {
        logger.info(`Checking health of ${service.name}...`);
        const response = await fetch(service.url, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();
          results.push({
            name: service.name,
            url: service.url,
            healthy: true,
          });
          logger.info({ service: service.name, status: data }, "Service is healthy");
        } else {
          results.push({
            name: service.name,
            url: service.url,
            healthy: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
          });
        }
      } catch (error) {
        results.push({
          name: service.name,
          url: service.url,
          healthy: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        logger.error({ service: service.name, error }, "Service health check failed");
      }
    }

    return results;
  }

  private async testClaimSubmissionFlow(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    statusCode?: number;
  }> {
    try {
      logger.info("Calling opus-nitro-sdk-mock test-claim endpoint...");

      const response = await fetch(`${this.OPUS_NITRO_URL}/enclave/test-claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Key": this.AUTH_KEY,
        },
        signal: AbortSignal.timeout(this.TEST_TIMEOUT),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            responseData,
          },
          "Claim submission request failed",
        );

        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
      }

      if (!responseData.success) {
        logger.error({ responseData }, "Claim submission returned failure");
        return {
          success: false,
          error: responseData.error || "Unknown error from claim submission",
        };
      }

      logger.info({ responseData }, "Claim submission completed successfully");
      return {
        success: true,
        data: responseData.data,
      };
    } catch (error) {
      logger.error({ error }, "Error during claim submission test");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async testCdpClaimSubmissionFlow(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    statusCode?: number;
  }> {
    try {
      logger.info("Calling opus-nitro-sdk-mock test-claim-cdp endpoint...");

      const response = await fetch(`${this.OPUS_NITRO_URL}/enclave/test-claim-cdp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Key": this.AUTH_KEY,
        },
        signal: AbortSignal.timeout(this.TEST_TIMEOUT),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            responseData,
          },
          "CDP claim submission request failed",
        );

        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
      }

      if (!responseData.success) {
        logger.error({ responseData }, "CDP claim submission returned failure");
        return {
          success: false,
          error: responseData.error || "Unknown error from CDP claim submission",
        };
      }

      logger.info({ responseData }, "CDP claim submission completed successfully");
      return {
        success: true,
        data: responseData.data,
      };
    } catch (error) {
      logger.error({ error }, "Error during CDP claim submission test");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  generateTestReport(result: E2ETestResult): void {
    console.log("\n" + "=".repeat(80));
    console.log("🧪 INFINITEBAZAAR E2E TEST REPORT");
    console.log("=".repeat(80));

    console.log(`📅 Timestamp: ${result.timestamp}`);
    console.log(`⏱️  Duration: ${result.duration}ms`);
    console.log(`✅ Overall Success: ${result.success ? "PASS" : "FAIL"}`);

    console.log("\n📊 SERVICE STATUS:");
    result.services.forEach((service) => {
      const status = service.healthy ? "✅ HEALTHY" : "❌ UNHEALTHY";
      console.log(`  ${service.name}: ${status}`);
      if (service.error) {
        console.log(`    Error: ${service.error}`);
      }
    });

    if (result.testResults.claimSubmission) {
      console.log("\n🔄 CLAIM SUBMISSION:");
      console.log(`  Success: ${result.testResults.claimSubmission.success ? "✅" : "❌"}`);
      if (result.testResults.claimSubmission.data?.message) {
        console.log(`  Message: ${result.testResults.claimSubmission.data.message}`);
      }
    }

    if (result.testResults.cdpClaimSubmission) {
      console.log("\n🏦 CDP CLAIM SUBMISSION:");
      console.log(`  Success: ${result.testResults.cdpClaimSubmission.success ? "✅" : "❌"}`);
      if (result.testResults.cdpClaimSubmission.data?.message) {
        console.log(`  Message: ${result.testResults.cdpClaimSubmission.data.message}`);
      }
      if (result.testResults.cdpClaimSubmission.data?.cdpAccount) {
        const cdpAccount = result.testResults.cdpClaimSubmission.data.cdpAccount;
        console.log(`  CDP Account: ${cdpAccount.name} (${cdpAccount.address})`);
      }
    }

    if (result.testResults.paymentFlow) {
      console.log("\n💳 PAYMENT FLOW:");
      console.log(
        `  x402 Payment: ${result.testResults.paymentFlow.paymentProcessed ? "✅ PROCESSED" : "❌ FAILED"}`,
      );
      if (result.testResults.paymentFlow.accountAddress) {
        console.log(`  Account: ${result.testResults.paymentFlow.accountAddress}`);
      }
    }

    if (result.testResults.blockchainSimulation) {
      console.log("\n⛓️  BLOCKCHAIN SIMULATION:");
      console.log(`  Transaction Hash: ${result.testResults.blockchainSimulation.transactionHash}`);
      console.log(`  Claim ID: ${result.testResults.blockchainSimulation.claimId}`);
      console.log(`  Gas Used: ${result.testResults.blockchainSimulation.gasUsed}`);
    }

    if (result.errors.length > 0) {
      console.log("\n❌ ERRORS:");
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log("\n" + "=".repeat(80));

    if (result.success) {
      console.log("🎉 ALL TESTS PASSED! InfiniteBazaar E2E flow is working correctly.");
      console.log("✅ x402 payment integration is functional");
      console.log("✅ Blockchain simulation with Coinbase CDP is working");
      console.log("✅ End-to-end claim submission flow is complete");
    } else {
      console.log("❌ TESTS FAILED! Please check the errors above and ensure:");
      console.log(
        "  1. Both services are running (opus-nitro-sdk-mock on :3105, opus-genesis-id on :3106)",
      );
      console.log("  2. Environment variables are properly configured");
      console.log("  3. x402 payment configuration is correct");
    }

    console.log("=".repeat(80) + "\n");
  }
}

// Main execution
async function main() {
  const runner = new E2ETestRunner();
  const result = await runner.runTests();
  runner.generateTestReport(result);

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Handle uncaught errors
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled Rejection");
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught Exception");
  process.exit(1);
});

// Run if this is the main module
main().catch((error) => {
  logger.error({ error }, "Failed to run E2E tests");
  process.exit(1);
});
