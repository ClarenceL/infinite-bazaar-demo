import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@infinite-bazaar-demo/logs";
import { http, createPublicClient, formatUnits, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { z } from "zod";
import { IPFSPublicationService } from "./ipfs-publication-service.js";
import { createCdpClient } from "./mock-cdp-service.js";
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
  ipfsPublication?: {
    success: boolean;
    ipfsHash?: string;
    pinataId?: string;
    filePath?: string;
    mode?: "ipfs+local" | "local-only";
    error?: string;
  };
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
  private readonly SUPPORTED_CURRENCIES = ["USDC", "usdc"];
  private readonly SERVICE_WALLET_ADDRESS: string;
  private publicClient;
  private readonly USDC_CONTRACT_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC
  private readonly BASE_SEPOLIA_RPC = "https://sepolia.base.org";
  private readonly claimsDir: string;
  private readonly ipfsService: IPFSPublicationService;

  constructor() {
    // Service wallet address for receiving payments
    this.SERVICE_WALLET_ADDRESS = process.env.X402_SERVICE_WALLET_ADDRESS || "";

    // Initialize viem client for Base Sepolia
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
    });

    // Set up claims directory
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const logsDir = path.join(__dirname, "..", "..", "logs");
    this.claimsDir = path.join(logsDir, "claims");

    // Ensure claims directory exists
    if (!fs.existsSync(this.claimsDir)) {
      fs.mkdirSync(this.claimsDir, { recursive: true });
      logger.info({ claimsDir: this.claimsDir }, "📁 Created claims directory");
    }

    if (!this.SERVICE_WALLET_ADDRESS) {
      logger.warn(
        "X402_SERVICE_WALLET_ADDRESS not configured - payment verification will use mock mode",
      );
    }

    // Initialize IPFS publication service
    this.ipfsService = new IPFSPublicationService();
  }

  /**
   * Save claim data to file in the claims directory
   */
  private saveClaimToFile(
    claimId: string,
    claim: ClaimSubmission,
    result: ClaimSubmissionResult,
    paymentId?: string,
    paymentDetails?: any,
  ): string {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `claim-${claimId}-${timestamp}.json`;
      const filepath = path.join(this.claimsDir, filename);

      const claimLogData = {
        claimId,
        timestamp: new Date().toISOString(),
        claim: {
          did: claim.did,
          claimType: claim.claimType,
          claimData: claim.claimData,
          issuer: claim.issuer,
          subject: claim.subject,
        },
        result: {
          success: result.success,
          transactionHash: result.transactionHash,
          gasUsed: result.gasUsed,
          timestamp: result.timestamp,
        },
        payment: paymentId
          ? {
              paymentId,
              details: paymentDetails,
            }
          : null,
        metadata: {
          serviceWalletConfigured: !!this.SERVICE_WALLET_ADDRESS,
          savedAt: new Date().toISOString(),
        },
      };

      fs.writeFileSync(filepath, JSON.stringify(claimLogData, null, 2));
      logger.info({ filepath, claimId }, "💾 Claim data saved to file");

      return filepath;
    } catch (error) {
      logger.error({ error, claimId }, "Failed to save claim to file");
      throw error;
    }
  }

  /**
   * Simulate blockchain transaction using Coinbase CDP
   * This demonstrates how claims would be stored on-chain after payment
   */
  async simulateBlockchainTransaction(
    claim: ClaimSubmission,
    claimId: string,
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    accountName?: string;
    error?: string;
  }> {
    try {
      logger.info(
        { claimId, did: claim.did },
        "Simulating blockchain transaction with Coinbase CDP",
      );

      // Initialize CDP client (mock or real depending on environment)
      const coinbase = createCdpClient({
        apiKeyName: process.env.CDP_API_KEY_NAME || "default-key",
        privateKey: process.env.CDP_PRIVATE_KEY || "default-private-key",
      });

      // Create or get account for claim storage
      const accountName = `claim-storage-${Date.now()}`;

      try {
        // In real implementation, this would create a wallet and interact with smart contracts
        // For now, we'll simulate the process
        const mockWalletId = `wallet-${Math.random().toString(36).substring(2, 15)}`;

        logger.info(
          {
            accountName,
            mockWalletId,
            claimId,
          },
          "Simulated CDP wallet creation for claim storage",
        );

        // Simulate a transaction (in real implementation, this would interact with a smart contract)
        const mockTransactionHash = `0x${Math.random().toString(16).substring(2, 66)}`;

        logger.info(
          {
            claimId,
            transactionHash: mockTransactionHash,
            accountName,
            did: claim.did,
          },
          "Simulated blockchain transaction for claim storage",
        );

        return {
          success: true,
          transactionHash: mockTransactionHash,
          accountName,
        };
      } catch (cdpError) {
        logger.warn({ error: cdpError }, "CDP simulation failed, using fallback mock transaction");

        // Fallback to mock transaction
        const mockTransactionHash = `0x${Math.random().toString(16).substring(2, 66)}`;

        return {
          success: true,
          transactionHash: mockTransactionHash,
          accountName: `mock-${accountName}`,
        };
      }
    } catch (error) {
      logger.error({ error, claimId }, "Failed to simulate blockchain transaction");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Submit a claim to the blockchain storage contract
   */
  async submitClaim(
    claim: ClaimSubmission,
    paymentId: string,
    paymentDetails?: any,
  ): Promise<ClaimSubmissionResult> {
    try {
      logger.info(
        {
          did: claim.did,
          claimType: claim.claimType,
          paymentId,
        },
        "Submitting claim to blockchain",
      );

      // Generate unique claim ID
      const claimId = `claim_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      let result: ClaimSubmissionResult;

      if (this.SERVICE_WALLET_ADDRESS) {
        // Real blockchain submission
        result = await this.submitClaimToContract(claim, claimId, paymentId);
      } else {
        // Mock submission for development
        logger.warn(
          "Using mock claim submission - configure blockchain contract for real submission",
        );
        result = await this.mockClaimSubmission(claim, claimId, paymentId);
      }

      // Save claim to file
      try {
        const filepath = this.saveClaimToFile(claimId, claim, result, paymentId, paymentDetails);
        logger.info(
          {
            claimId,
            filepath,
            transactionHash: result.transactionHash,
          },
          "Claim submitted and saved to file successfully",
        );
      } catch (saveError) {
        logger.error(
          { saveError, claimId },
          "Failed to save claim to file, but submission succeeded",
        );
        // Don't throw here - the claim was successfully submitted
      }

      // Automatically attempt IPFS upload for genesis-identity claims with entity data
      logger.info(
        {
          claimId,
          claimType: claim.claimType,
          hasClaimData: !!claim.claimData,
          hasEntityId: !!claim.claimData?.entityId,
          entityId: claim.claimData?.entityId,
          conditionalResult: claim.claimType === "genesis-identity" && claim.claimData?.entityId,
        },
        "🔍 IPFS Upload Conditional Check - Evaluating criteria",
      );

      if (claim.claimType === "genesis-identity" && claim.claimData?.entityId) {
        try {
          logger.info(
            {
              claimId,
              entityId: claim.claimData.entityId,
              did: claim.did,
            },
            "✅ IPFS Upload: Conditions met - Automatically uploading genesis identity claim to IPFS",
          );

          // Extract and structure the identity data for IPFS upload
          const authClaimData = this.extractAuthClaimData(claim.claimData);
          const genericClaimData = this.extractGenericClaimData(claim.claimData);

          const ipfsResult = await this.publishClaimToIPFS(
            claim.claimData.entityId as string, // We already checked entityId exists above
            claim.did,
            authClaimData,
            genericClaimData,
          );

          if (ipfsResult.success) {
            logger.info(
              {
                claimId,
                ipfsHash: ipfsResult.ipfsHash,
                pinataId: ipfsResult.pinataId,
                mode: ipfsResult.mode,
              },
              "Successfully uploaded genesis identity claim to IPFS",
            );
          } else {
            logger.warn(
              {
                claimId,
                error: ipfsResult.error,
              },
              "Failed to upload genesis identity claim to IPFS, but blockchain submission succeeded",
            );
          }

          // Include IPFS result in the response
          result.ipfsPublication = {
            success: ipfsResult.success,
            ipfsHash: ipfsResult.ipfsHash,
            pinataId: ipfsResult.pinataId,
            filePath: ipfsResult.filePath,
            mode: ipfsResult.mode,
            error: ipfsResult.error,
          };
        } catch (ipfsError) {
          logger.error(
            {
              claimId,
              error: ipfsError,
            },
            "Error during automatic IPFS upload - continuing with successful claim submission",
          );

          // Include error in IPFS result
          result.ipfsPublication = {
            success: false,
            error: ipfsError instanceof Error ? ipfsError.message : "Unknown IPFS error",
          };
        }
      } else {
        logger.info(
          {
            claimId,
            claimType: claim.claimType,
            hasClaimData: !!claim.claimData,
            hasEntityId: !!claim.claimData?.entityId,
            entityId: claim.claimData?.entityId,
            reason:
              !claim.claimType || claim.claimType !== "genesis-identity"
                ? "claimType is not 'genesis-identity'"
                : "entityId is missing or falsy",
          },
          "❌ IPFS Upload: Conditions NOT met - Skipping automatic IPFS upload",
        );
      }

      return result;
    } catch (error) {
      logger.error({ error, claim, paymentId }, "Failed to submit claim");
      throw error;
    }
  }

  /**
   * Submit claim to actual blockchain contract
   */
  private async submitClaimToContract(
    claim: ClaimSubmission,
    claimId: string,
    paymentId: string,
  ): Promise<ClaimSubmissionResult> {
    try {
      // Simulate blockchain transaction with Coinbase CDP
      const blockchainResult = await this.simulateBlockchainTransaction(claim, claimId);

      if (!blockchainResult.success) {
        throw new Error(`Blockchain simulation failed: ${blockchainResult.error}`);
      }

      logger.info(
        {
          claimId,
          transactionHash: blockchainResult.transactionHash,
          accountName: blockchainResult.accountName,
          did: claim.did,
          paymentId,
        },
        "Claim submitted to blockchain using CDP simulation",
      );

      return {
        success: true,
        claimId,
        transactionHash:
          blockchainResult.transactionHash || `0x${Math.random().toString(16).substring(2, 66)}`,
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
  private async mockClaimSubmission(
    claim: ClaimSubmission,
    claimId: string,
    paymentId: string,
  ): Promise<ClaimSubmissionResult> {
    // Simulate blockchain interaction delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const mockTransactionHash = `0x${Math.random().toString(16).substring(2, 66)}`;

    logger.info(
      {
        claimId,
        transactionHash: mockTransactionHash,
        did: claim.did,
        paymentId,
      },
      "Claim submitted successfully (mock)",
    );

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
   * Get all claims from saved files
   */
  async getAllClaims(limit = 10, offset = 0): Promise<any[]> {
    try {
      logger.info({ limit, offset }, "Retrieving all claims from saved files");

      // Read all claim files from the claims directory
      if (!fs.existsSync(this.claimsDir)) {
        logger.info({ claimsDir: this.claimsDir }, "Claims directory does not exist");
        return [];
      }

      const files = fs
        .readdirSync(this.claimsDir)
        .filter((file) => file.startsWith("claim-") && file.endsWith(".json"));

      // Sort files by modification time (newest first)
      const fileStats = files.map((file) => ({
        file,
        path: path.join(this.claimsDir, file),
        mtime: fs.statSync(path.join(this.claimsDir, file)).mtime,
      }));

      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Apply pagination
      const paginatedFiles = fileStats.slice(offset, offset + limit);

      // Read and parse claim files
      const claims = paginatedFiles
        .map((fileInfo) => {
          try {
            const content = fs.readFileSync(fileInfo.path, "utf8");
            return JSON.parse(content);
          } catch (parseError) {
            logger.error({ error: parseError, file: fileInfo.file }, "Failed to parse claim file");
            return null;
          }
        })
        .filter(Boolean); // Remove null entries

      logger.info(
        {
          totalFiles: files.length,
          returnedClaims: claims.length,
          limit,
          offset,
        },
        "Retrieved claims from saved files",
      );

      return claims;
    } catch (error) {
      logger.error({ error }, "Failed to retrieve claims from files");
      throw error;
    }
  }

  /**
   * Get claim by claim ID from saved files
   */
  async getClaimById(claimId: string): Promise<any | null> {
    try {
      logger.info({ claimId }, "Retrieving claim by ID from saved files");

      const files = fs
        .readdirSync(this.claimsDir)
        .filter((file) => file.includes(claimId) && file.endsWith(".json"));

      if (files.length === 0) {
        logger.info({ claimId }, "Claim not found in saved files");
        return null;
      }

      // If multiple files match, use the most recent one
      const file = files[files.length - 1];
      const filepath = path.join(this.claimsDir, file);

      const content = fs.readFileSync(filepath, "utf8");
      const claim = JSON.parse(content);

      logger.info({ claimId, filepath }, "Retrieved claim from saved file");
      return claim;
    } catch (error) {
      logger.error({ error, claimId }, "Failed to retrieve claim by ID");
      throw error;
    }
  }

  /**
   * Publish verifiable claim data to IPFS
   * This should be called after successful claim submission with the complete identity data
   */
  async publishClaimToIPFS(
    entityId: string,
    did: string,
    authClaimResult: any,
    genericClaimResult: any,
  ): Promise<{
    success: boolean;
    ipfsHash?: string;
    filePath?: string;
    pinataId?: string;
    error?: string;
    mode?: "ipfs+local" | "local-only";
  }> {
    try {
      logger.info(
        {
          entityId,
          did,
        },
        "Publishing verifiable claim data to IPFS",
      );

      // Prepare publication data (excludes sensitive information)
      const publicationData = this.ipfsService.preparePublicationData(
        entityId,
        did,
        authClaimResult,
        genericClaimResult,
      );

      // Publish to IPFS
      const result = await this.ipfsService.publishToIPFS(publicationData);

      if (result.success) {
        logger.info(
          {
            entityId,
            did,
            ipfsHash: result.ipfsHash,
            filePath: result.filePath,
          },
          "Successfully published verifiable claim data to IPFS",
        );
      } else {
        logger.error(
          {
            entityId,
            did,
            error: result.error,
          },
          "Failed to publish claim data to IPFS",
        );
      }

      return result;
    } catch (error) {
      logger.error(
        {
          error,
          entityId,
          did,
        },
        "Error publishing claim to IPFS",
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Verify a published claim from IPFS
   */
  async verifyClaimFromIPFS(ipfsHash: string): Promise<{
    valid: boolean;
    data?: any;
    errors?: string[];
  }> {
    try {
      logger.info({ ipfsHash }, "Verifying claim from IPFS");

      const result = await this.ipfsService.verifyPublishedClaim(ipfsHash);

      logger.info(
        {
          ipfsHash,
          valid: result.valid,
          errorCount: result.errors?.length || 0,
        },
        "Claim verification result",
      );

      return result;
    } catch (error) {
      logger.error({ error, ipfsHash }, "Error verifying claim from IPFS");

      return {
        valid: false,
        errors: [error instanceof Error ? error.message : "Verification error"],
      };
    }
  }

  /**
   * List all published claims in IPFS
   */
  async listIPFSClaims(): Promise<
    Array<{
      entityId: string;
      did: string;
      timestamp: string;
      ipfsHash: string;
      filePath?: string;
      pinataId?: string;
      source: "pinata" | "local";
    }>
  > {
    try {
      logger.info("Listing all published claims from IPFS");

      const claims = await this.ipfsService.listPublishedClaims();

      logger.info({ claimCount: claims.length }, "Retrieved published claims list");

      return claims;
    } catch (error) {
      logger.error({ error }, "Error listing IPFS claims");
      return [];
    }
  }

  /**
   * Extract AuthClaim data from claim submission data
   */
  private extractAuthClaimData(claimData: any): any {
    // Check if authClaim data is nested under authClaim property
    const authClaim = claimData.authClaim || claimData;

    return {
      identityState: authClaim.identityState || claimData.identityState || "mock-identity-state",
      claimsTreeRoot:
        authClaim.claimsTreeRoot || claimData.claimsTreeRoot || "mock-claims-tree-root",
      revocationTreeRoot:
        authClaim.revocationTreeRoot || claimData.revocationTreeRoot || "mock-revocation-tree-root",
      rootsTreeRoot: authClaim.rootsTreeRoot || claimData.rootsTreeRoot || "mock-roots-tree-root",
      publicKeyX: authClaim.publicKeyX || claimData.publicKeyX || "mock-public-key-x",
      publicKeyY: authClaim.publicKeyY || claimData.publicKeyY || "mock-public-key-y",
      hIndex: authClaim.hIndex || claimData.hIndex || "mock-h-index",
      hValue: authClaim.hValue || claimData.hValue || "mock-h-value",
    };
  }

  /**
   * Extract GenericClaim data from claim submission data
   */
  private extractGenericClaimData(claimData: any): any {
    // Check if genericClaim data is nested under genericClaim property
    const genericClaim = claimData.genericClaim || claimData;

    return {
      claimHash: genericClaim.claimHash || claimData.claimHash || "mock-claim-hash",
      signature: genericClaim.signature || claimData.signature || "mock-signature",
      claimData: {
        llmModel: {
          name: claimData.llmModel || genericClaim.claimData?.llmModel?.name || "unknown-model",
          version: "1.0.0",
          provider: "unknown",
        },
        weightsRevision: {
          hash:
            claimData.weightsHash ||
            genericClaim.claimData?.weightsRevision?.hash ||
            "mock-weights-hash",
          version: "1.0.0",
          checksum:
            claimData.weightsHash ||
            genericClaim.claimData?.weightsRevision?.hash ||
            "mock-weights-hash",
        },
        systemPrompt: {
          hash:
            claimData.promptHash ||
            genericClaim.claimData?.systemPrompt?.hash ||
            "mock-prompt-hash",
          template: "Mock system prompt for testing",
        },
        relationshipGraph: {
          hash:
            claimData.relationshipHash ||
            genericClaim.claimData?.relationshipGraph?.hash ||
            "mock-relationship-hash",
          nodeCount: 2,
          edgeCount: 1,
        },
      },
    };
  }
}
