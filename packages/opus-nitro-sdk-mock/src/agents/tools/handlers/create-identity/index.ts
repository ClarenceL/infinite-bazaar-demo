import { CdpClient } from "@coinbase/cdp-sdk";
import { db, entities, eq } from "@infinite-bazaar-demo/db";
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
 * Handle create identity with x402 payment using existing CDP account
 *
 * - The identity is created silently in the opus-genesis-id package using Privado SDK
 * - Requires that create_name has been called first to set up the CDP account
 *
 * This function:
 * 1. Retrieves existing CDP account from database
 * 2. Gets service info from opus-genesis-id
 * 3. Creates x402-enabled fetch client using CDP account
 * 4. Submits claim with automatic payment
 * 5. Returns the result
 */
export async function handleCreateIdentity(input: Record<string, any>): Promise<ToolCallResult> {
  const OPUS_GENESIS_ID_URL = process.env.OPUS_GENESIS_ID_URL || "http://localhost:3106";
  const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
  const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
  const CDP_WALLET_SECRET = process.env.CDP_WALLET_SECRET;

  try {
    logger.info({ input }, "Starting identity creation process with x402 payment");

    // Extract entity_id from input
    const { entity_id } = input;

    if (!entity_id || typeof entity_id !== "string") {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "entity_id is required and must be a string",
        },
        name: "create_identity",
      };
    }

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
        name: "create_identity",
      };
    }

    // Step 1: Get existing CDP account info from database
    logger.info({ entity_id }, "Retrieving existing CDP account info from database");

    const entityResults = await db
      .select()
      .from(entities)
      .where(eq(entities.entityId, entity_id))
      .limit(1);

    if (entityResults.length === 0) {
      logger.error({ entity_id }, "Entity not found in database");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Entity not found. Please create a name first using create_name.",
        },
        name: "create_identity",
      };
    }

    const entity = entityResults[0]!; // We know it exists because we checked length above
    if (!entity.cdp_name || !entity.name) {
      logger.error({ entity_id }, "Entity does not have a name or CDP account");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Entity does not have a name or CDP account. Please create a name first using create_name.",
        },
        name: "create_identity",
      };
    }

    // Step 2: Initialize CDP client and get existing account
    logger.info("Initializing Coinbase CDP client...");
    const cdpClient = new CdpClient({
      apiKeyId: CDP_API_KEY_ID,
      apiKeySecret: CDP_API_KEY_SECRET,
      walletSecret: CDP_WALLET_SECRET,
    });

    logger.info({ cdpName: entity.cdp_name }, "Retrieving existing CDP account...");
    const cdpAccount = await cdpClient.evm.getOrCreateAccount({
      name: entity.cdp_name,
    });

    logger.info(
      {
        accountName: cdpAccount.name,
        accountId: (cdpAccount as any).id || "unknown",
      },
      "CDP account retrieved successfully",
    );

    // Step 3: Convert CDP account to viem LocalAccount for x402-fetch
    const viemAccount = toAccount<LocalAccount>(cdpAccount as any);

    logger.info(
      {
        accountAddress: viemAccount.address,
      },
      "Converted CDP account to viem account",
    );

    // Step 2: Get service information and pricing (no payment required)
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
        name: "create_identity",
      };
    }

    const serviceInfo = serviceInfoResult.data;
    logger.info({ serviceInfo }, "Retrieved service information");

    // Step 3: Create x402-enabled fetch client using CDP account
    const fetchWithPayment = wrapFetchWithPayment(fetch, viemAccount);

    logger.info(
      {
        accountAddress: viemAccount.address,
        x402Enabled: serviceInfo.x402Enabled,
        cdpAccountName: cdpAccount.name,
      },
      "Created x402-enabled fetch client with CDP account",
    );

    // Step 4: Prepare claim data
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

    // Step 5: Submit claim with automatic x402 payment using CDP account
    logger.info("Submitting claim with x402 payment using CDP account");

    // Log the CDP account before payment
    logger.info(
      {
        cdpAddress: viemAccount.address,
        cdpAccountName: cdpAccount.name,
        network: "base-sepolia",
      },
      "CDP Account ready for payment",
    );

    const claimResponse = await fetchWithPayment(`${OPUS_GENESIS_ID_URL}/genesis/claim/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(claimData),
    });

    logger.info(
      {
        responseStatus: claimResponse.status,
        cdpAddress: viemAccount.address,
      },
      "Claim submission completed",
    );

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
        name: "create_identity",
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
      name: "create_identity",
    };
  } catch (error) {
    logger.error({ error }, "Error in handleCreateIdentity function");

    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: false,
        error: "Internal error during CDP claim submission",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      name: "create_identity",
    };
  }
}
