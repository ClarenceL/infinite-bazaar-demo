import { ClaimService, type ClaimSubmission } from "@/services/claim-service";
import { logger } from "@infinite-bazaar-demo/logs";

export interface GenesisClaimResponse {
  success: boolean;
  claimId?: string;
  transactionHash?: string;
  timestamp: string;
  error?: string;
}

export class GenesisService {
  private claimService: ClaimService;

  constructor() {
    this.claimService = new ClaimService();
    logger.info("GenesisService initialized");
  }

  /**
   * Process a claim submission that has already been verified by x402 middleware
   */
  async processX402VerifiedClaim(claim: ClaimSubmission): Promise<GenesisClaimResponse> {
    try {
      logger.info(
        {
          did: claim.did,
          claimType: claim.claimType,
        },
        "Processing x402-verified claim submission",
      );

      // Generate unique payment ID for tracking (payment already verified by middleware)
      const paymentId = `x402_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      // Submit claim to blockchain storage (ClaimService will handle IPFS upload automatically)
      const claimResult = await this.claimService.submitClaim(claim, paymentId);

      if (!claimResult.success) {
        throw new Error("Claim submission failed");
      }

      logger.info(
        {
          claimId: claimResult.claimId,
          transactionHash: claimResult.transactionHash,
        },
        "x402-verified claim submission completed successfully",
      );

      return {
        success: true,
        claimId: claimResult.claimId,
        transactionHash: claimResult.transactionHash,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error }, "Failed to process x402-verified claim submission");

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get claim information by DID
   */
  async getClaimByDID(did: string): Promise<unknown> {
    try {
      logger.info({ did }, "Retrieving claim by DID");
      return await this.claimService.getClaimByDID(did);
    } catch (error) {
      logger.error({ error, did }, "Failed to retrieve claim by DID");
      throw error;
    }
  }

  /**
   * Get service status and pricing information
   */
  async getServiceInfo() {
    return {
      service: "opus-genesis-id",
      version: "0.0.1",
      description: "x402 endpoint for Privado ID claim submission",
      pricing: {
        claimSubmission: "0.0001 USDC",
        currency: "USDC",
        paymentMethod: "x402",
      },
      endpoints: {
        submitClaim: "POST /genesis/claim/submit",
        getClaim: "GET /genesis/claim/:did",
        serviceInfo: "GET /genesis/info",
      },
      status: "active",
      timestamp: new Date().toISOString(),
    };
  }
}
