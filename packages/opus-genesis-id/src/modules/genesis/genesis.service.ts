import { ClaimService, type ClaimSubmission, type X402Payment } from "@/services/claim-service";
import { logger } from "@infinite-bazaar-demo/logs";

export interface GenesisClaimRequest {
  claim: ClaimSubmission;
  payment: X402Payment;
}

export interface GenesisClaimResponse {
  success: boolean;
  paymentId?: string;
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
   * Process a complete genesis claim submission with x402 payment
   */
  async processGenesisClaimSubmission(request: GenesisClaimRequest): Promise<GenesisClaimResponse> {
    try {
      logger.info({
        did: request.claim.did,
        claimType: request.claim.claimType,
        paymentAmount: request.payment.amount
      }, "Processing genesis claim submission");

      // Step 1: Verify x402 payment
      const paymentResult = await this.claimService.verifyX402Payment(request.payment);

      if (!paymentResult.success || !paymentResult.verified) {
        throw new Error("Payment verification failed");
      }

      // Step 2: Submit claim to blockchain
      const claimResult = await this.claimService.submitClaim(request.claim, paymentResult.paymentId);

      if (!claimResult.success) {
        throw new Error("Claim submission failed");
      }

      logger.info({
        paymentId: paymentResult.paymentId,
        claimId: claimResult.claimId,
        transactionHash: claimResult.transactionHash
      }, "Genesis claim submission completed successfully");

      return {
        success: true,
        paymentId: paymentResult.paymentId,
        claimId: claimResult.claimId,
        transactionHash: claimResult.transactionHash,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error }, "Failed to process genesis claim submission");

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
  async getClaimByDID(did: string): Promise<ClaimSubmission | null> {
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
        claimSubmission: "1 USDC",
        currency: "USDC",
        paymentMethod: "x402"
      },
      endpoints: {
        submitClaim: "POST /genesis/claim/submit",
        getClaim: "GET /genesis/claim/:did",
        serviceInfo: "GET /genesis/info"
      },
      status: "active",
      timestamp: new Date().toISOString(),
    };
  }
} 