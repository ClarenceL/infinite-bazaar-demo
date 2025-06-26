import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@infinite-bazaar-demo/logs";
import { PinataSDK } from "pinata";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Feature flag to control IPFS uploading (always writes to local disk regardless)
const ENABLE_IPFS_UPLOAD = process.env.ENABLE_IPFS_UPLOAD === "true";

export interface IPFSPublicationData {
  // Metadata
  version: string;
  timestamp: string;
  networkId: string;

  // Agent Identity
  agentId: string;
  did: string;

  // AuthClaim Public Data (for verification)
  authClaim: {
    identityState: string;
    claimsTreeRoot: string;
    revocationTreeRoot: string;
    rootsTreeRoot: string;
    publicKeyX: string;
    publicKeyY: string;
    hIndex: string;
    hValue: string;
  };

  // Generic Claim Data (signed agent configuration)
  genericClaim: {
    claimHash: string;
    signature: string;
    claimData: {
      llmModel: {
        name: string;
        version: string;
        provider: string;
      };
      weightsRevision: {
        hash: string;
        version: string;
        checksum: string;
      };
      systemPrompt: {
        hash: string;
        template?: string; // Optional - may be too large
      };
      relationshipGraph: {
        hash: string;
        nodeCount: number;
        edgeCount: number;
      };
    };
  };

  // Verification Information
  verification: {
    schemaHashes: {
      authClaim: string;
      agentConfig: string;
    };
    merkleProofs?: {
      claimsTreeProof: any;
      authClaimProof: any;
    };
    networkConfig: {
      chainId: number;
      contractAddress: string;
      rpcUrl: string;
    };
  };
}

export class IPFSPublicationService {
  private readonly ipfsDir: string;
  private readonly pinata?: PinataSDK;
  private readonly baseGroupId: string;
  private readonly ipfsEnabled: boolean;

  constructor() {
    // Create IPFS directory in logs folder (always created for local storage)
    const logsDir = path.join(__dirname, "..", "..", "logs");
    this.ipfsDir = path.join(logsDir, "ipfs");

    if (!fs.existsSync(this.ipfsDir)) {
      fs.mkdirSync(this.ipfsDir, { recursive: true });
      logger.info({ ipfsDir: this.ipfsDir }, "Created IPFS publication directory");
    }

    this.ipfsEnabled = ENABLE_IPFS_UPLOAD;
    this.baseGroupId = process.env.PINATA_BASE_GROUP || "";

    if (this.ipfsEnabled) {
      // Initialize Pinata SDK only if IPFS upload is enabled
      const pinataJwt = process.env.PINATA_JWT;
      const pinataGateway = process.env.PINATA_GATEWAY;

      if (!pinataJwt) {
        logger.warn("PINATA_JWT not found - IPFS upload disabled, using local storage only");
        this.ipfsEnabled = false;
      } else {
        this.pinata = new PinataSDK({
          pinataJwt,
          pinataGateway,
        });

        logger.info(
          {
            hasJwt: !!pinataJwt,
            hasGateway: !!pinataGateway,
            hasBaseGroup: !!this.baseGroupId,
            ipfsEnabled: true,
          },
          "Initialized Pinata SDK for IPFS publication",
        );
      }
    } else {
      logger.info(
        {
          ipfsEnabled: false,
          reason: "ENABLE_IPFS_UPLOAD=false or missing",
        },
        "IPFS upload disabled - using local storage only",
      );
    }
  }

  /**
   * Prepare verifiable claim data for IPFS publication
   * Excludes all sensitive information (private keys, seeds, payment details)
   */
  preparePublicationData(
    agentId: string,
    did: string,
    authClaimResult: any,
    genericClaimResult: any,
  ): IPFSPublicationData {
    const publicationData: IPFSPublicationData = {
      // Metadata
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      networkId: "polygon:amoy",

      // Agent Identity
      agentId,
      did,

      // AuthClaim Public Data (for verification)
      authClaim: {
        identityState: authClaimResult.identityState,
        claimsTreeRoot: authClaimResult.claimsTreeRoot,
        revocationTreeRoot: authClaimResult.revocationTreeRoot,
        rootsTreeRoot: authClaimResult.rootsTreeRoot,
        publicKeyX: authClaimResult.publicKeyX,
        publicKeyY: authClaimResult.publicKeyY,
        hIndex: authClaimResult.hIndex,
        hValue: authClaimResult.hValue,
      },

      // Generic Claim Data (signed agent configuration)
      genericClaim: {
        claimHash: genericClaimResult.claimHash,
        signature: genericClaimResult.signature,
        claimData: genericClaimResult.claimData,
      },

      // Verification Information
      verification: {
        schemaHashes: {
          authClaim: "ca938857241db9451ea329256b9c06e5", // Standard Iden3 auth schema
          agentConfig: "f9c2b5e8a7d3c1e4f6a8b9c0d1e2f3a4", // Custom agent config schema
        },
        networkConfig: {
          chainId: 80002,
          contractAddress: "0x1a4cC30f2aA0377b0c3bc9848766D90cb4404124",
          rpcUrl: "https://rpc-amoy.polygon.technology/",
        },
      },
    };

    logger.info(
      {
        agentId,
        did,
        dataSize: JSON.stringify(publicationData).length,
      },
      "Prepared verifiable claim data for IPFS publication",
    );

    return publicationData;
  }

  /**
   * Publish claim data (always saves locally, optionally uploads to IPFS via Pinata)
   */
  async publishToIPFS(publicationData: IPFSPublicationData): Promise<{
    success: boolean;
    ipfsHash?: string;
    filePath?: string;
    pinataId?: string;
    error?: string;
    mode: "ipfs+local" | "local-only";
  }> {
    const dataString = JSON.stringify(publicationData, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `ipfs-${publicationData.agentId}-${timestamp}.json`;
    const localFilePath = path.join(this.ipfsDir, filename);

    // Always save locally first
    try {
      fs.writeFileSync(localFilePath, dataString);
      logger.info(
        {
          agentId: publicationData.agentId,
          did: publicationData.did,
          filePath: localFilePath,
          dataSize: dataString.length,
        },
        "Saved claim data to local storage",
      );
    } catch (localError) {
      logger.error(
        {
          error: localError,
          agentId: publicationData.agentId,
        },
        "Failed to save claim data locally",
      );

      return {
        success: false,
        error: `Local save failed: ${localError instanceof Error ? localError.message : "Unknown error"}`,
        filePath: localFilePath,
        mode: "local-only",
      };
    }

    // Try IPFS upload if enabled
    if (this.ipfsEnabled && this.pinata) {
      try {
        // Create a File object for Pinata upload
        const file = new File([dataString], `claim-${publicationData.agentId}-${Date.now()}.json`, {
          type: "application/json",
        });

        logger.info(
          {
            agentId: publicationData.agentId,
            did: publicationData.did,
            dataSize: dataString.length,
            hasBaseGroup: !!this.baseGroupId,
          },
          "Uploading verifiable claim data to IPFS via Pinata",
        );

        // Upload to Pinata with metadata and group
        let upload = this.pinata.upload.public
          .file(file)
          .name(`Agent Claim: ${publicationData.agentId}`)
          .keyvalues({
            agentId: publicationData.agentId,
            did: publicationData.did,
            claimType: "genesis-identity",
            version: publicationData.version,
            networkId: publicationData.networkId,
            timestamp: publicationData.timestamp,
          });

        // Add to group if specified
        if (this.baseGroupId) {
          upload = upload.group(this.baseGroupId);
        }

        const result = await upload;

        logger.info(
          {
            agentId: publicationData.agentId,
            did: publicationData.did,
            ipfsHash: result.cid,
            pinataId: result.id,
            dataSize: dataString.length,
            groupId: this.baseGroupId || "none",
            localBackup: localFilePath,
          },
          "Successfully published verifiable claim data to IPFS via Pinata",
        );

        return {
          success: true,
          ipfsHash: result.cid,
          pinataId: result.id,
          filePath: localFilePath,
          mode: "ipfs+local",
        };
      } catch (ipfsError) {
        logger.warn(
          {
            error: ipfsError,
            agentId: publicationData.agentId,
          },
          "IPFS upload failed, but local save succeeded",
        );

        return {
          success: true, // Local save succeeded
          error: `IPFS upload failed: ${ipfsError instanceof Error ? ipfsError.message : "Unknown error"}`,
          filePath: localFilePath,
          mode: "local-only",
        };
      }
    } else {
      logger.info(
        {
          agentId: publicationData.agentId,
          ipfsEnabled: this.ipfsEnabled,
          reason: !this.ipfsEnabled ? "IPFS upload disabled" : "Pinata not initialized",
        },
        "Skipping IPFS upload - local storage only",
      );

      return {
        success: true,
        filePath: localFilePath,
        mode: "local-only",
      };
    }
  }

  /**
   * Verify published claim data from IPFS
   * This fetches the data from IPFS via Pinata gateway and validates it
   */
  async verifyPublishedClaim(ipfsHash: string): Promise<{
    valid: boolean;
    data?: IPFSPublicationData;
    errors?: string[];
    source?: "pinata" | "local";
  }> {
    try {
      logger.info({ ipfsHash }, "Verifying published claim from IPFS");

      let data: IPFSPublicationData;
      let source: "pinata" | "local" = "pinata";

      try {
        // Try to fetch from IPFS via Pinata gateway
        const gatewayUrl = this.pinata?.config?.pinataGateway;
        const ipfsUrl = gatewayUrl
          ? `https://${gatewayUrl}/ipfs/${ipfsHash}`
          : `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

        logger.info({ ipfsUrl }, "Fetching claim data from IPFS gateway");

        const response = await fetch(ipfsUrl);

        if (!response.ok) {
          throw new Error(`Gateway fetch failed: ${response.status} ${response.statusText}`);
        }

        const dataString = await response.text();
        data = JSON.parse(dataString);

        logger.info(
          { ipfsHash, source: "pinata" },
          "Successfully fetched claim data from IPFS gateway",
        );
      } catch (gatewayError) {
        logger.warn(
          { error: gatewayError, ipfsHash },
          "Failed to fetch from IPFS gateway, trying local storage",
        );

        // Fallback to local storage
        const files = fs.readdirSync(this.ipfsDir);
        const matchingFile = files.find((file) => file.includes(ipfsHash.slice(2, 10)));

        if (!matchingFile) {
          return {
            valid: false,
            errors: [`IPFS hash ${ipfsHash} not found in gateway or local storage`],
          };
        }

        const filePath = path.join(this.ipfsDir, matchingFile);
        const dataString = fs.readFileSync(filePath, "utf-8");
        data = JSON.parse(dataString);
        source = "local";

        logger.info(
          { ipfsHash, source: "local" },
          "Successfully fetched claim data from local storage",
        );
      }

      // Perform comprehensive validation
      const errors: string[] = [];

      // Basic structure validation
      if (!data.did || !data.did.startsWith("did:iden3:")) {
        errors.push("Invalid or missing DID");
      }

      if (!data.agentId || typeof data.agentId !== "string") {
        errors.push("Invalid or missing agent ID");
      }

      if (!data.version || !data.timestamp) {
        errors.push("Missing version or timestamp");
      }

      // AuthClaim validation
      if (!data.authClaim) {
        errors.push("Missing authClaim data");
      } else {
        if (!data.authClaim.identityState || data.authClaim.identityState.length !== 64) {
          errors.push("Invalid identity state");
        }

        if (!data.authClaim.publicKeyX || !data.authClaim.publicKeyY) {
          errors.push("Missing public key coordinates");
        }

        if (
          !data.authClaim.claimsTreeRoot ||
          !data.authClaim.revocationTreeRoot ||
          !data.authClaim.rootsTreeRoot
        ) {
          errors.push("Missing Merkle tree roots");
        }
      }

      // Generic claim validation
      if (!data.genericClaim) {
        errors.push("Missing genericClaim data");
      } else {
        if (!data.genericClaim.signature || data.genericClaim.signature.length < 100) {
          errors.push("Invalid or missing signature");
        }

        if (!data.genericClaim.claimHash) {
          errors.push("Missing claim hash");
        }

        if (!data.genericClaim.claimData || !data.genericClaim.claimData.llmModel) {
          errors.push("Missing or invalid claim data structure");
        }
      }

      // Verification metadata validation
      if (!data.verification || !data.verification.networkConfig) {
        errors.push("Missing verification metadata");
      }

      // TODO: Add cryptographic verification of signatures and Merkle proofs
      // TODO: Verify claim hash matches the claim data
      // TODO: Verify signature against public key

      const isValid = errors.length === 0;

      logger.info(
        {
          ipfsHash,
          valid: isValid,
          errorCount: errors.length,
          source,
          agentId: data.agentId,
          did: data.did,
        },
        "Completed claim verification",
      );

      return {
        valid: isValid,
        data: isValid ? data : undefined,
        errors: errors.length > 0 ? errors : undefined,
        source,
      };
    } catch (error) {
      logger.error({ error, ipfsHash }, "Error verifying published claim");

      return {
        valid: false,
        errors: [error instanceof Error ? error.message : "Verification error"],
      };
    }
  }

  /**
   * List all published claims from Pinata and local storage
   */
  async listPublishedClaims(): Promise<
    Array<{
      agentId: string;
      did: string;
      timestamp: string;
      ipfsHash: string;
      filePath?: string;
      pinataId?: string;
      source: "pinata" | "local";
    }>
  > {
    try {
      logger.info("Listing published claims from Pinata and local storage");

      const claims: Array<{
        agentId: string;
        did: string;
        timestamp: string;
        ipfsHash: string;
        filePath?: string;
        pinataId?: string;
        source: "pinata" | "local";
      }> = [];

      // Try to list files from Pinata (only if IPFS is enabled and Pinata is initialized)
      if (this.ipfsEnabled && this.pinata) {
        try {
          const pinataFiles = await this.pinata.files.public.list();

          logger.info(
            {
              pinataFileCount: pinataFiles.files?.length || 0,
              hasBaseGroup: !!this.baseGroupId,
            },
            "Retrieved files from Pinata",
          );

          // Process Pinata files
          for (const file of pinataFiles.files || []) {
            try {
              const keyvalues = file.keyvalues || {};

              claims.push({
                agentId: keyvalues.agentId || "unknown",
                did: keyvalues.did || "unknown",
                timestamp: keyvalues.timestamp || new Date().toISOString(),
                ipfsHash: file.cid,
                pinataId: file.id,
                source: "pinata",
              });
            } catch (fileError) {
              logger.warn({ file: file.id, error: fileError }, "Failed to process Pinata file");
            }
          }
        } catch (pinataError) {
          logger.warn(
            { error: pinataError },
            "Failed to list files from Pinata, continuing with local only",
          );
        }
      } else {
        logger.info("Skipping Pinata file listing - IPFS disabled or not initialized");
      }

      // Also check local storage as backup/fallback
      try {
        if (fs.existsSync(this.ipfsDir)) {
          const localFiles = fs
            .readdirSync(this.ipfsDir)
            .filter((file) => file.startsWith("ipfs-") && file.endsWith(".json"));

          for (const file of localFiles) {
            try {
              const filePath = path.join(this.ipfsDir, file);
              const dataString = fs.readFileSync(filePath, "utf-8");
              const data: IPFSPublicationData = JSON.parse(dataString);

              // Check if this claim is already in the Pinata results
              const existsInPinata = claims.some(
                (claim) =>
                  claim.agentId === data.agentId &&
                  claim.did === data.did &&
                  Math.abs(
                    new Date(claim.timestamp).getTime() - new Date(data.timestamp).getTime(),
                  ) < 60000, // Within 1 minute
              );

              if (!existsInPinata) {
                // Generate a mock IPFS hash for local files that weren't uploaded to Pinata
                const mockIpfsHash = `Qm${Buffer.from(dataString).toString("base64").slice(0, 44)}`;

                claims.push({
                  agentId: data.agentId,
                  did: data.did,
                  timestamp: data.timestamp,
                  ipfsHash: mockIpfsHash,
                  filePath,
                  source: "local",
                });
              }
            } catch (fileError) {
              logger.warn({ file, error: fileError }, "Failed to parse local claim file");
            }
          }
        }
      } catch (localError) {
        logger.warn({ error: localError }, "Failed to read local claim files");
      }

      // Sort by timestamp (newest first)
      claims.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      logger.info(
        {
          totalClaims: claims.length,
          pinataClaims: claims.filter((c) => c.source === "pinata").length,
          localClaims: claims.filter((c) => c.source === "local").length,
        },
        "Listed all published claims",
      );

      return claims;
    } catch (error) {
      logger.error({ error }, "Failed to list published claims");
      return [];
    }
  }
}
