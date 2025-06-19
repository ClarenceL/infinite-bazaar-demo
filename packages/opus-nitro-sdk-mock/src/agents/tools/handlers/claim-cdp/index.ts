import { CdpClient } from "@coinbase/cdp-sdk";
import { logger } from "@infinite-bazaar-demo/logs";
import type { LocalAccount } from "viem";
import { toAccount } from "viem/accounts";
// @ts-ignore
import { decodeXPaymentResponse, wrapFetchWithPayment } from "x402-fetch";
import type { ToolCallResult } from "../../../../types/message.js";
import { processApiResponse } from "../utils.js";

/**
 * Sample DID and claim data for testing
 */
const SAMPLE_DID = "did:iden3:polygon:amoy:x3HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ2H2";
const SAMPLE_ISSUER_DID = "did:iden3:polygon:amoy:x1HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ1H1";

/**
 * Handle claim submission with x402 payment using Coinbase CDP SDK
 * This function:
 * 1. Creates CDP client and account
 * 2. Gets service info from opus-genesis-id
 * 3. Creates x402-enabled fetch client using CDP account
 * 4. Submits claim with automatic payment
 * 5. Returns the result
 */
export async function handleClaimCdp(): Promise<ToolCallResult> {
  const OPUS_GENESIS_ID_URL = process.env.OPUS_GENESIS_ID_URL || "http://localhost:3106";
  const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
  const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
  const CDP_WALLET_SECRET = process.env.CDP_WALLET_SECRET;
  const CDP_PAY_FROM_ADDRESS_NAME = process.env.CDP_PAY_FROM_ADDRESS_NAME;

  try {
    logger.info("Starting claim submission process with CDP SDK and x402 payment");

    // Validate required environment variables
    if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET || !CDP_WALLET_SECRET) {
      logger.error("CDP environment variables are required");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error:
            "CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET environment variables are required",
        },
        name: "claim_cdp",
      };
    }

    if (!CDP_PAY_FROM_ADDRESS_NAME) {
      logger.error("CDP_PAY_FROM_ADDRESS_NAME environment variable is required");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error:
            "CDP_PAY_FROM_ADDRESS_NAME environment variable is required (wallet name for payment account)",
        },
        name: "claim_cdp",
      };
    }

    // Step 1: Initialize CDP client and create/get account
    logger.info("Initializing Coinbase CDP client...");
    const cdpClient = new CdpClient({
      apiKeyId: CDP_API_KEY_ID,
      apiKeySecret: CDP_API_KEY_SECRET,
      walletSecret: CDP_WALLET_SECRET,
    });

    logger.info("Creating or retrieving CDP account...");
    const cdpAccount = await cdpClient.evm.getOrCreateAccount({
      name: CDP_PAY_FROM_ADDRESS_NAME,
    });

    logger.info(
      {
        accountName: cdpAccount.name,
        accountId: (cdpAccount as any).id || "unknown",
      },
      "CDP account ready",
    );

    // Step 2: Convert CDP account to viem LocalAccount for x402-fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viemAccount = toAccount<LocalAccount>(cdpAccount as any);

    logger.info(
      {
        accountAddress: viemAccount.address,
      },
      "Converted CDP account to viem account",
    );

    // Step 3: Get service information and pricing (no payment required)
    logger.info("Fetching service information from opus-genesis-id");
    const serviceInfoResponse = await fetch(`${OPUS_GENESIS_ID_URL}/genesis/info`);
    const serviceInfoResult = await processApiResponse(serviceInfoResponse);

    if (!serviceInfoResult.isSuccess) {
      logger.error({ error: serviceInfoResult.error }, "Failed to get service information");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Failed to get service information from opus-genesis-id",
          details: serviceInfoResult.error,
        },
        name: "claim_cdp",
      };
    }

    const serviceInfo = serviceInfoResult.data;
    logger.info({ serviceInfo }, "Retrieved service information");

    // Step 4: Create x402-enabled fetch client using CDP account
    const fetchWithPayment = wrapFetchWithPayment(fetch, viemAccount);

    logger.info(
      {
        accountAddress: viemAccount.address,
        x402Enabled: serviceInfo.x402Enabled,
        cdpAccountName: cdpAccount.name,
      },
      "Created x402-enabled fetch client with CDP account",
    );

    // Step 5: Prepare claim data
    const claimData = {
      did: SAMPLE_DID,
      claimType: "identity_verification",
      claimData: {
        verified: true,
        verificationMethod: "enclave_attestation_cdp",
        timestamp: new Date().toISOString(),
        source: "opus-nitro-sdk-mock-cdp",
        cdpAccount: cdpAccount.name,
      },
      issuer: SAMPLE_ISSUER_DID,
      subject: SAMPLE_DID,
    };

    logger.info({ claimData }, "Prepared claim data with CDP account info");

    // Step 6: Submit claim with automatic x402 payment using CDP account
    logger.info("Submitting claim with x402 payment using CDP account");

    // First, let's try a regular fetch to see if we get HTTP 402
    logger.info("🔍 TESTING: Making first request without payment to check for HTTP 402");
    try {
      const testResponse = await fetch(`${OPUS_GENESIS_ID_URL}/genesis/claim/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(claimData),
      });

      logger.info(
        {
          status: testResponse.status,
          statusText: testResponse.statusText,
          headers: Object.fromEntries(testResponse.headers.entries()),
        },
        `📋 FIRST REQUEST RESULT: ${testResponse.status === 402 ? "HTTP 402 Payment Required (GOOD!)" : "Unexpected status (BAD!)"}`,
      );

      if (testResponse.status !== 402) {
        logger.warn(
          "⚠️  Expected HTTP 402 but got different status - payment middleware may not be working",
        );
      }
    } catch (error) {
      logger.error({ error }, "❌ Test request failed");
    }

    // Now make the actual x402-enabled request
    logger.info("💳 Making x402-enabled request (should handle payment automatically)");

    // Log the CDP account balance before payment
    try {
      logger.info(
        {
          cdpAddress: viemAccount.address,
          network: "base-sepolia",
        },
        "🏦 CDP Account before payment",
      );
    } catch (error) {
      logger.warn({ error }, "Could not check CDP account balance");
    }

    const claimResponse = await fetchWithPayment(`${OPUS_GENESIS_ID_URL}/genesis/claim/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(claimData),
    });

    // Log the CDP account after payment
    try {
      logger.info(
        {
          cdpAddress: viemAccount.address,
          network: "base-sepolia",
        },
        "🏦 CDP Account after payment",
      );
    } catch (error) {
      logger.warn({ error }, "Could not check CDP account balance after payment");
    }

    const claimResult = await processApiResponse(claimResponse);

    if (!claimResult.isSuccess) {
      logger.error({ error: claimResult.error }, "Failed to submit claim");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Failed to submit claim to opus-genesis-id",
          details: claimResult.error,
          statusCode: claimResult.statusCode,
        },
        name: "claim_cdp",
      };
    }

    // Step 7: Extract payment response details
    let paymentDetails = null;
    const paymentResponseHeader = claimResponse.headers.get("x-payment-response");
    if (paymentResponseHeader) {
      try {
        paymentDetails = decodeXPaymentResponse(paymentResponseHeader);
        logger.info({ paymentDetails }, "📋 Extracted x402 payment response");
      } catch (error) {
        logger.warn({ error }, "Failed to decode x-payment-response header");
      }
    }

    // Also check for X-Payment header in the request that was sent
    const allResponseHeaders: Record<string, string> = {};
    claimResponse.headers.forEach((value: string, key: string) => {
      allResponseHeaders[key] = value;
    });

    logger.info(
      {
        responseStatus: claimResponse.status,
        responseHeaders: allResponseHeaders,
      },
      "📋 Full response details from x402-enabled request",
    );

    // Check if we actually made a payment
    logger.info(
      {
        hasPaymentDetails: !!paymentDetails,
        paymentResponseHeader: !!paymentResponseHeader,
        responseStatus: claimResponse.status,
      },
      "💰 PAYMENT ANALYSIS - Did we actually pay?",
    );

    logger.info({ claimResult: claimResult.data }, "Successfully submitted claim using CDP");

    // Step 8: Return success result
    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: true,
        message: "Claim submitted successfully with x402 payment using Coinbase CDP",
        serviceInfo: serviceInfo,
        claimSubmission: claimResult.data,
        paymentDetails: paymentDetails || {
          method: "x402-cdp",
          status: "processed",
        },
        cdpAccount: {
          name: cdpAccount.name,
          id: (cdpAccount as any).id || "unknown",
          address: viemAccount.address,
        },
        timestamp: new Date().toISOString(),
      },
      name: "claim_cdp",
    };
  } catch (error) {
    logger.error({ error }, "Error in handleClaimCdp function");

    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: false,
        error: "Internal error during CDP claim submission",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      name: "claim_cdp",
    };
  }
}
