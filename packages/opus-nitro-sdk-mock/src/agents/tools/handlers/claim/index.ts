import { logger } from "@infinite-bazaar-demo/logs";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
// @ts-ignore
import { decodeXPaymentResponse, wrapFetchWithPayment } from "x402-fetch";
import type { ToolCallResult } from "../../../../types/message";
import { processApiResponse } from "../utils";

/**
 * Sample DID and claim data for testing
 */
const SAMPLE_DID = "did:iden3:polygon:amoy:x3HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ2H2";
const SAMPLE_ISSUER_DID = "did:iden3:polygon:amoy:x1HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ1H1";

/**
 * Handle claim submission with x402 payment
 * This function:
 * 1. Gets service info from opus-genesis-id
 * 2. Creates x402-enabled fetch client
 * 3. Submits claim with automatic payment
 * 4. Returns the result
 */
export async function handleClaim(): Promise<ToolCallResult> {
  const OPUS_GENESIS_ID_URL = process.env.OPUS_GENESIS_ID_URL || "http://localhost:3106";
  const PRIVATE_KEY = process.env.X402_PRIVATE_KEY as Hex;

  try {
    logger.info("Starting claim submission process with x402 payment");

    // Validate required environment variables
    if (!PRIVATE_KEY) {
      logger.error("X402_PRIVATE_KEY environment variable is required");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "X402_PRIVATE_KEY environment variable is required for payment",
        },
        name: "claim",
      };
    }

    // Step 1: Get service information and pricing (no payment required)
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
        name: "claim",
      };
    }

    const serviceInfo = serviceInfoResult.data;
    logger.info({ serviceInfo }, "Retrieved service information");

    // Step 2: Create x402-enabled fetch client
    const account = privateKeyToAccount(PRIVATE_KEY);
    const fetchWithPayment = wrapFetchWithPayment(fetch, account);

    logger.info(
      {
        accountAddress: account.address,
        x402Enabled: serviceInfo.x402Enabled,
      },
      "Created x402-enabled fetch client",
    );

    // Step 3: Prepare claim data
    const claimData = {
      did: SAMPLE_DID,
      claimType: "identity_verification",
      claimData: {
        verified: true,
        verificationMethod: "enclave_attestation",
        timestamp: new Date().toISOString(),
        source: "opus-nitro-sdk-mock",
      },
      issuer: SAMPLE_ISSUER_DID,
      subject: SAMPLE_DID,
    };

    logger.info({ claimData }, "Prepared claim data");

    // Step 4: Submit claim with automatic x402 payment
    logger.info("Submitting claim with x402 payment to opus-genesis-id");

    const claimResponse = await fetchWithPayment(`${OPUS_GENESIS_ID_URL}/genesis/claim/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(claimData),
    });

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
        name: "claim",
      };
    }

    // Step 5: Extract payment response details
    let paymentDetails = null;
    const paymentResponseHeader = claimResponse.headers.get("x-payment-response");
    if (paymentResponseHeader) {
      try {
        paymentDetails = decodeXPaymentResponse(paymentResponseHeader);
        logger.info({ paymentDetails }, "Extracted x402 payment response");
      } catch (error) {
        logger.warn({ error }, "Failed to decode x-payment-response header");
      }
    }

    logger.info({ claimResult: claimResult.data }, "Successfully submitted claim");

    // Step 6: Return success result
    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: true,
        message: "Claim submitted successfully with x402 payment",
        serviceInfo: serviceInfo,
        claimSubmission: claimResult.data,
        paymentDetails: paymentDetails || {
          method: "x402",
          status: "processed",
        },
        accountAddress: account.address,
        timestamp: new Date().toISOString(),
      },
      name: "claim",
    };
  } catch (error) {
    logger.error({ error }, "Error in handleClaim function");

    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: false,
        error: "Internal error during claim submission",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      name: "claim",
    };
  }
}
