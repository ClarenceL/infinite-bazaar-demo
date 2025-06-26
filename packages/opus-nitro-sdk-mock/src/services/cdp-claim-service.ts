import { db, entities, eq } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";
import type { LocalAccount } from "viem";
// @ts-ignore
import { decodeXPaymentResponse, wrapFetchWithPayment } from "x402-fetch";
import {
  createCdpClient,
  createMockViemAccount,
  processApiResponse,
} from "../agents/tools/handlers/utils.js";
import type { UnifiedIdentityResult } from "./unified-identity-service.js";

/**
 * Result of CDP claim submission with x402 payment
 */
export interface CDPClaimSubmissionResult {
  success: boolean;
  claimSubmission?: any;
  paymentDetails?: any;
  cdpAccount?: {
    name: string;
    id: string;
    address: string;
  };
  error?: string;
  statusCode?: number;
  timestamp: string;
}

/**
 * Service for handling CDP wallet operations and x402 payments for claim submissions
 */
export class CDPClaimService {
  private readonly OPUS_GENESIS_ID_URL: string;
  private readonly CDP_API_KEY_ID: string;
  private readonly CDP_API_KEY_SECRET: string;
  private readonly CDP_WALLET_SECRET: string;

  constructor() {
    this.OPUS_GENESIS_ID_URL = process.env.OPUS_GENESIS_ID_URL || "http://localhost:3106";
    this.CDP_API_KEY_ID = process.env.CDP_API_KEY_ID!;
    this.CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET!;
    this.CDP_WALLET_SECRET = process.env.CDP_WALLET_SECRET!;

    // Validate required environment variables
    if (!this.CDP_API_KEY_ID || !this.CDP_API_KEY_SECRET || !this.CDP_WALLET_SECRET) {
      throw new Error(
        "CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET environment variables are required",
      );
    }

    logger.info("CDPClaimService initialized with CDP configuration");
  }

  /**
   * Submit a claim with x402 payment using an existing CDP account
   */
  async submitClaimWithPayment(
    entityId: string,
    unifiedResult: UnifiedIdentityResult,
  ): Promise<CDPClaimSubmissionResult> {
    try {
      logger.info(
        { entityId, agentId: unifiedResult.agentId },
        "Starting CDP claim submission with x402 payment",
      );

      // Step 1: Get existing CDP account info from database
      const entity = await this.getEntityFromDatabase(entityId);
      if (!entity) {
        return {
          success: false,
          error: "Entity not found. Please create a name first using create_name.",
          timestamp: new Date().toISOString(),
        };
      }

      // Check if entity has a CDP name
      if (!entity.cdp_name) {
        return {
          success: false,
          error:
            "Entity does not have a CDP account. Please create a name first using create_name.",
          timestamp: new Date().toISOString(),
        };
      }

      // Step 2: Initialize CDP client and get existing account
      const { cdpAccount, viemAccount } = await this.initializeCDPAccount(entity.cdp_name);

      // Step 3: Get service information and pricing
      const serviceInfo = await this.getServiceInfo();
      if (!serviceInfo) {
        return {
          success: false,
          error: "Failed to get service information from opus-genesis-id",
          timestamp: new Date().toISOString(),
        };
      }

      // Step 4: Prepare claim data for submission
      const claimData = this.prepareClaimData(unifiedResult, entity.cdp_name!);

      // Step 5: Submit claim with x402 payment
      const submissionResult = await this.submitClaimWithX402Payment(
        claimData,
        viemAccount,
        cdpAccount,
      );

      return {
        success: true,
        claimSubmission: submissionResult.claimResult,
        paymentDetails: submissionResult.paymentDetails,
        cdpAccount: {
          name: cdpAccount.name!,
          id: (cdpAccount as any).id || "unknown",
          address: viemAccount.address,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error, entityId }, "Error in CDP claim submission");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get entity from database
   */
  private async getEntityFromDatabase(entityId: string) {
    const entityResults = await db
      .select()
      .from(entities)
      .where(eq(entities.entityId, entityId))
      .limit(1);

    if (entityResults.length === 0) {
      logger.error({ entityId }, "Entity not found in database");
      return null;
    }

    const entity = entityResults[0]!;
    if (!entity.cdp_name || !entity.name) {
      logger.error({ entityId }, "Entity does not have a name or CDP account");
      return null;
    }

    return entity;
  }

  /**
   * Initialize CDP client and get existing account
   */
  private async initializeCDPAccount(cdpName: string) {
    logger.info("Initializing Coinbase CDP client...");
    const cdpClient = createCdpClient({
      apiKeyId: this.CDP_API_KEY_ID,
      apiKeySecret: this.CDP_API_KEY_SECRET,
      walletSecret: this.CDP_WALLET_SECRET,
    });

    logger.info({ cdpName }, "Retrieving existing CDP account...");
    const cdpAccount = await cdpClient.evm.getOrCreateAccount({
      name: cdpName,
    });

    logger.info(
      {
        accountName: cdpAccount.name,
        accountId: (cdpAccount as any).id || "unknown",
      },
      "CDP account retrieved successfully",
    );

    // Convert CDP account to viem LocalAccount for x402-fetch
    const viemAccount = createMockViemAccount(cdpAccount as any);

    logger.info(
      {
        accountAddress: viemAccount.address,
      },
      "Converted CDP account to viem account",
    );

    return { cdpAccount, viemAccount };
  }

  /**
   * Get service information and pricing
   */
  private async getServiceInfo() {
    logger.info("Fetching service information from opus-genesis-id");
    const serviceInfoResponse = await fetch(`${this.OPUS_GENESIS_ID_URL}/genesis/info`);
    const serviceInfoResult = await processApiResponse(serviceInfoResponse);

    if (!serviceInfoResult.isSuccess) {
      logger.error({ error: serviceInfoResult.error }, "Failed to get service information");
      return null;
    }

    const serviceInfo = serviceInfoResult.data;
    logger.info({ serviceInfo }, "Retrieved service information");
    return serviceInfo;
  }

  /**
   * Prepare claim data for submission
   */
  private prepareClaimData(unifiedResult: UnifiedIdentityResult, cdpAccountName: string) {
    const claimData = {
      did: unifiedResult.did,
      claimType: "nitro_enclave_agent_identity",
      claimData: {
        agentId: unifiedResult.agentId,
        claimHash: unifiedResult.genericClaim.claimHash,
        signature: unifiedResult.genericClaim.signature,
        verificationMethod: "nitro_enclave_attestation",
        timestamp: unifiedResult.timestamp,
        source: "opus-nitro-sdk-mock",
        cdpAccount: cdpAccountName,
      },
      issuer: unifiedResult.did, // Self-issued for now
      subject: unifiedResult.did,
    };

    logger.info({ claimData }, "Prepared claim data for submission");
    return claimData;
  }

  /**
   * Submit claim with x402 payment
   */
  private async submitClaimWithX402Payment(
    claimData: any,
    viemAccount: LocalAccount,
    cdpAccount: any,
  ) {
    // Create x402-enabled fetch client using CDP account
    const fetchWithPayment = wrapFetchWithPayment(fetch, viemAccount);

    logger.info(
      {
        accountAddress: viemAccount.address,
        cdpAccountName: cdpAccount.name,
      },
      "Created x402-enabled fetch client with CDP account",
    );

    // Submit claim with automatic x402 payment using CDP account
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

    const claimResponse = await fetchWithPayment(
      `${this.OPUS_GENESIS_ID_URL}/genesis/claim/submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(claimData),
      },
    );

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
      throw new Error(`Failed to submit claim: ${claimResult.error}`);
    }

    // Extract payment response details
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

    // Log all response headers for debugging
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

    return {
      claimResult: claimResult.data,
      paymentDetails: paymentDetails || {
        method: "x402-cdp",
        status: "processed",
      },
    };
  }
}
