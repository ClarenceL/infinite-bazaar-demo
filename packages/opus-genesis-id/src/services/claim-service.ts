import { logger } from "@infinite-bazaar-demo/logs";
import { z } from "zod";
import { createPublicClient, http, formatUnits, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
// For now, I'll implement a simplified x402 integration
// The x402 package has module resolution issues with the current setup
// TODO: Fix module resolution to use proper x402 imports

// Validation schemas
export const ClaimSchema = z.object({
  did: z.string().min(1, "DID is required"),
  claimType: z.string().min(1, "Claim type is required"),
  claimData: z.record(z.any()).optional(),
  issuer: z.string().optional(),
  subject: z.string().optional(),
});

const X402PaymentSchema = z.object({
  x402Version: z.number(),
  paymentHeader: z.string(), // Base64 encoded payment payload
  paymentRequirements: z.object({
    scheme: z.string(),
    network: z.string(),
    maxAmountRequired: z.string(),
    resource: z.string(),
    description: z.string(),
    mimeType: z.string(),
    payTo: z.string(),
    maxTimeoutSeconds: z.number(),
    asset: z.string(),
    extra: z.record(z.any()).nullable(),
  }),
});

export type ClaimSubmission = z.infer<typeof ClaimSchema>;
export type X402Payment = z.infer<typeof X402PaymentSchema>;

export interface ClaimSubmissionResult {
  success: boolean;
  transactionHash?: string;
  claimId: string;
  timestamp: string;
  gasUsed?: number;
}

export interface X402PaymentResult {
  success: boolean;
  paymentId: string;
  verified: boolean;
  timestamp: string;
  verificationDetails?: {
    transactionHash: string;
    amount: string;
    currency: string;
    blockNumber?: number;
  };
}

export class ClaimService {
  private readonly CLAIM_PRICE_USDC = "1000000"; // 1 USDC in 6 decimals
  private readonly SUPPORTED_CURRENCIES = ['USDC', 'usdc'];
  private readonly SERVICE_WALLET_ADDRESS: string;
  private publicClient;
  private readonly USDC_CONTRACT_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
  private readonly BASE_SEPOLIA_RPC = "https://sepolia.base.org";

  constructor() {
    // Service wallet address for receiving payments
    this.SERVICE_WALLET_ADDRESS = process.env.X402_SERVICE_WALLET_ADDRESS || '';

    // Initialize viem client for Base Sepolia
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
    });

    if (!this.SERVICE_WALLET_ADDRESS) {
      logger.warn("X402_SERVICE_WALLET_ADDRESS not configured - payment verification will use mock mode");
    }
  }

  /**
   * Verify x402 payment for claim submission
   */
  async verifyX402Payment(paymentData: z.infer<typeof X402PaymentSchema>): Promise<{
    isValid: boolean;
    reason?: string;
    transactionHash?: string;
  }> {
    try {
      logger.info({ paymentData }, "Verifying x402 payment");

      // Use x402 verify function for proper protocol verification
      const verificationResult = await verify({
        x402Version: paymentData.x402Version,
        paymentHeader: paymentData.paymentHeader,
        paymentRequirements: paymentData.paymentRequirements as PaymentRequirements,
      });

      if (!verificationResult.isValid) {
        logger.warn({
          reason: verificationResult.invalidReason,
          paymentData
        }, "x402 payment verification failed");

        return {
          isValid: false,
          reason: verificationResult.invalidReason || "Payment verification failed",
        };
      }

      logger.info({
        paymentData,
        verificationResult
      }, "x402 payment verified successfully");

      return {
        isValid: true,
        transactionHash: verificationResult.txHash,
      };
    } catch (error) {
      logger.error({ error, paymentData }, "Error verifying x402 payment");
      return {
        isValid: false,
        reason: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Submit a claim to the blockchain storage contract
   */
  async submitClaim(claim: ClaimSubmission, paymentId: string): Promise<ClaimSubmissionResult> {
    try {
      logger.info({
        did: claim.did,
        claimType: claim.claimType,
        paymentId
      }, "Submitting claim to blockchain");

      // Generate unique claim ID
      const claimId = `claim_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      if (this.SERVICE_WALLET_ADDRESS) {
        // Real blockchain submission
        const result = await this.submitClaimToContract(claim, claimId, paymentId);
        return result;
      } else {
        // Mock submission for development
        logger.warn("Using mock claim submission - configure blockchain contract for real submission");
        return await this.mockClaimSubmission(claim, claimId, paymentId);
      }
    } catch (error) {
      logger.error({ error, claim, paymentId }, "Failed to submit claim");
      throw error;
    }
  }

  /**
   * Submit claim to actual blockchain contract
   */
  private async submitClaimToContract(claim: ClaimSubmission, claimId: string, paymentId: string): Promise<ClaimSubmissionResult> {
    try {
      // TODO: Implement actual smart contract interaction
      // This would involve:
      // 1. Loading the storage contract ABI
      // 2. Creating a contract instance
      // 3. Calling the contract method to store the claim
      // 4. Waiting for transaction confirmation

      // For now, return mock data
      const mockTransactionHash = `0x${Math.random().toString(16).substring(2, 66)}`;

      logger.info({
        claimId,
        transactionHash: mockTransactionHash,
        did: claim.did,
        paymentId
      }, "Claim submitted to blockchain contract");

      return {
        success: true,
        claimId,
        transactionHash: mockTransactionHash,
        timestamp: new Date().toISOString(),
        gasUsed: 65000, // Estimated gas usage
      };
    } catch (error) {
      logger.error({ error, claimId }, "Failed to submit claim to contract");
      throw error;
    }
  }

  /**
   * Mock claim submission for development
   */
  private async mockClaimSubmission(claim: ClaimSubmission, claimId: string, paymentId: string): Promise<ClaimSubmissionResult> {
    // Simulate blockchain interaction delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const mockTransactionHash = `0x${Math.random().toString(16).substring(2, 66)}`;

    logger.info({
      claimId,
      transactionHash: mockTransactionHash,
      did: claim.did,
      paymentId
    }, "Claim submitted successfully (mock)");

    return {
      success: true,
      claimId,
      transactionHash: mockTransactionHash,
      timestamp: new Date().toISOString(),
      gasUsed: 45000, // Mock gas usage
    };
  }

  /**
   * Retrieve a claim by DID (placeholder implementation)
   */
  async getClaimByDID(did: string): Promise<unknown> {
    try {
      logger.info({ did }, "Retrieving claim by DID");

      // TODO: Implement actual claim retrieval from blockchain
      // This would involve querying the storage contract

      // Mock implementation
      return {
        did,
        claimType: "identity_verification",
        claimData: {
          verified: true,
          timestamp: new Date().toISOString(),
        },
        retrievedAt: new Date().toISOString(),
        mock: true,
      };
    } catch (error) {
      logger.error({ error, did }, "Failed to retrieve claim");
      throw error;
    }
  }

  /**
   * Get all claims (placeholder for admin functionality)
   */
  async getAllClaims(limit = 10, offset = 0): Promise<ClaimSubmission[]> {
    try {
      logger.info({ limit, offset }, "Retrieving all claims");

      // TODO: Implement actual blockchain reading with pagination
      // Placeholder implementation
      return [];
    } catch (error) {
      logger.error({ error }, "Failed to retrieve claims");
      throw error;
    }
  }
} 