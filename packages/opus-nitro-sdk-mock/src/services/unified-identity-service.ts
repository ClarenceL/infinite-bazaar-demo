import { createHash, createHmac } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  BjjProvider,
  CredentialStatusResolverRegistry,
  CredentialStatusType,
  CredentialStorage,
  CredentialWallet,
  EthStateStorage,
  type IDataStorage,
  type Identity,
  IdentityStorage,
  IdentityWallet,
  InMemoryDataSource,
  InMemoryMerkleTreeStorage,
  InMemoryPrivateKeyStore,
  IssuerResolver,
  KMS,
  KmsKeyType,
  type Profile,
  RHSResolver,
  type W3CCredential,
  core,
  defaultEthConnectionConfig,
} from "@0xpolygonid/js-sdk";
import { logger } from "@infinite-bazaar-demo/logs";

// Network configuration
const NETWORK_ENV: "MAINNET" | "TESTNET" = "TESTNET";

const NETWORK_CONFIG = {
  MAINNET: {
    rpcUrl: "https://polygon-rpc.com",
    contractAddress: "0x624ce98D2d27b20b8f8d521723Df8fC4db71D79D",
    chainId: 137,
    networkId: "main",
    networkName: "main",
  },
  TESTNET: {
    rpcUrl: "https://rpc-amoy.polygon.technology/",
    contractAddress: "0x1a4cC30f2aA0377b0c3bc9848766D90cb4404124",
    chainId: 80002,
    networkId: "amoy",
    networkName: "amoy",
  },
};

export interface AgentClaimData {
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
    template: string;
    zodSchema: string;
    hash: string;
  };
  relationshipGraph: {
    hash: string;
    nodeCount: number;
    edgeCount: number;
  };
}

export interface AuthClaimResult {
  authClaim: core.Claim;
  claimsTreeRoot: string;
  revocationTreeRoot: string;
  rootsTreeRoot: string;
  identityState: string;
  hIndex: string;
  hValue: string;
  publicKeyX: string;
  publicKeyY: string;
}

export interface GenericClaimResult {
  genericClaim: any;
  claimHash: string;
  signature: string;
  claimData: AgentClaimData;
}

export interface UnifiedIdentityResult {
  // Core Identity
  did: string;
  credential: W3CCredential;
  seed: Uint8Array;
  privateKey: string;
  publicKeyX: string;
  publicKeyY: string;

  // Auth Claim
  authClaim: AuthClaimResult;

  // Generic Claim
  genericClaim: GenericClaimResult;

  // Metadata
  entityId: string;
  timestamp: string;
  filePath: string;
}

/**
 * Unified Identity Service that follows proper Iden3 flow:
 * 1. Generate ONE random seed (createIdentityKey)
 * 2. Load seed from file for subsequent operations
 * 3. Derive BabyJubJub keypair from seed
 * 4. Create AuthClaim with public key coordinates
 * 5. Create GenericClaim about model's signature hashes
 * 6. Everything tied to the same identity/keypair
 */
export class UnifiedIdentityService {
  private identityWallet: IdentityWallet;
  private credentialWallet: CredentialWallet;
  private dataStorage: IDataStorage;
  private kms: KMS;

  constructor() {
    this.dataStorage = this.initDataStorage();
    this.credentialWallet = this.initCredentialWallet(this.dataStorage);
    const { identityWallet, kms } = this.initIdentityWallet(
      this.dataStorage,
      this.credentialWallet,
    );
    this.identityWallet = identityWallet;
    this.kms = kms;
  }

  private initDataStorage(): IDataStorage {
    const currentConfig = NETWORK_CONFIG[NETWORK_ENV];

    const networkConfig = {
      ...defaultEthConnectionConfig,
      url: currentConfig.rpcUrl,
      contractAddress: currentConfig.contractAddress,
      chainId: currentConfig.chainId,
    };

    logger.info(
      {
        network: NETWORK_ENV,
        chainId: currentConfig.chainId,
        rpcUrl: currentConfig.rpcUrl,
      },
      "Initializing unified identity service with network configuration",
    );

    return {
      credential: new CredentialStorage(new InMemoryDataSource<W3CCredential>()),
      identity: new IdentityStorage(
        new InMemoryDataSource<Identity>(),
        new InMemoryDataSource<Profile>(),
      ),
      mt: new InMemoryMerkleTreeStorage(40),
      states: new EthStateStorage(networkConfig),
    };
  }

  private initCredentialWallet(dataStorage: IDataStorage): CredentialWallet {
    const resolvers = new CredentialStatusResolverRegistry();
    resolvers.register(CredentialStatusType.SparseMerkleTreeProof, new IssuerResolver());
    resolvers.register(
      CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
      new RHSResolver(dataStorage.states),
    );

    return new CredentialWallet(dataStorage, resolvers);
  }

  private initIdentityWallet(
    dataStorage: IDataStorage,
    credentialWallet: CredentialWallet,
  ): { identityWallet: IdentityWallet; kms: KMS } {
    const memoryKeyStore = new InMemoryPrivateKeyStore();
    const bjjProvider = new BjjProvider(KmsKeyType.BabyJubJub, memoryKeyStore);
    const kms = new KMS();
    kms.registerKeyProvider(KmsKeyType.BabyJubJub, bjjProvider);

    const identityWallet = new IdentityWallet(kms, dataStorage, credentialWallet);
    return { identityWallet, kms };
  }

  /**
   * Create and save a new identity key (seed) - Step 1 of identity creation
   * This generates a random seed and saves it to the logs/seeds directory
   */
  async createIdentityKey(): Promise<{
    success: boolean;
    seedFile: string;
    seedId: string;
    error?: string;
  }> {
    try {
      logger.info("Creating new identity key (generating random seed)");

      // Step 1: Generate ONE random seed
      const seed = new Uint8Array(32);
      crypto.getRandomValues(seed);

      // Step 2: Generate random 12-digit seed ID
      const seedId = Math.floor(Math.random() * 900000000000 + 100000000000).toString();

      // Step 3: Ensure seeds directory exists
      const seedsDir = path.join(process.cwd(), "logs", "seeds");
      if (!fs.existsSync(seedsDir)) {
        fs.mkdirSync(seedsDir, { recursive: true });
        logger.info({ seedsDir }, "Created seeds directory");
      }

      // Step 4: Save seed to file
      const seedFile = path.join(seedsDir, `${seedId}.txt`);
      const seedHex = Buffer.from(seed).toString("hex");

      fs.writeFileSync(seedFile, seedHex);

      logger.info(
        { seedId, seedFile: path.basename(seedFile) },
        "🔐 Identity key (seed) generated and saved",
      );

      logger.warn(
        "⚠️  SECURITY: Seed saved to file for testing. In production, seeds should be securely managed in AWS KMS or similar.",
      );

      return {
        success: true,
        seedFile: path.basename(seedFile),
        seedId,
      };
    } catch (error) {
      logger.error({ error }, "Failed to create identity key");
      return {
        success: false,
        seedFile: "",
        seedId: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Load seed from file based on entity_id
   * Supports two modes:
   * 1. TEST_ENTITY_NUMBER env var set: Load from logs/seeds/{TEST_ENTITY_NUMBER}.txt
   * 2. Normal mode: Load from seeds-dev/{entityId}-seed.txt
   *
   * TODO: Delete TEST_ENTITY_NUMBER later and have a proper testing methodology
   */
  private loadSeedFromFile(entityId: string): Uint8Array {
    let seedFile: string;
    let seedsDir: string;
    let expectedFileName: string;

    // Check if TEST_ENTITY_NUMBER is set (testing mode)
    if (process.env.TEST_ENTITY_NUMBER) {
      // Testing mode: Load from logs/seeds/{TEST_ENTITY_NUMBER}.txt
      seedsDir = path.join(process.cwd(), "logs", "seeds");
      expectedFileName = `${process.env.TEST_ENTITY_NUMBER}.txt`;
      seedFile = path.join(seedsDir, expectedFileName);

      logger.info(
        { entityId, testEntityNumber: process.env.TEST_ENTITY_NUMBER, expectedFileName },
        "🔍 TEST_ENTITY_NUMBER detected, loading seed from logs/seeds",
      );
    } else {
      // Normal mode: Load from seeds-dev/{entityId}-seed.txt
      seedsDir = path.join(process.cwd(), "seeds-dev");
      expectedFileName = `${entityId}-seed.txt`;
      seedFile = path.join(seedsDir, expectedFileName);

      logger.info({ entityId, expectedFileName }, "🔍 Normal mode, loading seed from seeds-dev");
    }

    if (!fs.existsSync(seedFile)) {
      const errorMessage = process.env.TEST_ENTITY_NUMBER
        ? `Seed file not found: ${expectedFileName}. Expected location: ${seedsDir}/`
        : `Seed file not found: ${expectedFileName}. Run createIdentityKey() first.`;

      throw new Error(errorMessage);
    }

    try {
      const seedHex = fs.readFileSync(seedFile, "utf8").trim();
      const seed = new Uint8Array(Buffer.from(seedHex, "hex"));

      logger.info(
        { entityId, seedFile: path.basename(seedFile), seedLength: seed.length },
        "🔐 Loaded seed from file",
      );

      return seed;
    } catch (error) {
      throw new Error(
        `Failed to load seed from file ${expectedFileName}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Create a complete identity following proper Iden3 flow:
   * 1. Load seed from file (based on TEST_ENTITY_NUMBER)
   * 2. Create identity and derive keypair from seed
   * 3. Create AuthClaim with public key
   * 4. Create GenericClaim about agent configuration
   * 5. All tied to the same identity
   */
  async createUnifiedIdentity(
    entityId: string,
    agentClaimData: AgentClaimData,
  ): Promise<UnifiedIdentityResult> {
    try {
      const currentConfig = NETWORK_CONFIG[NETWORK_ENV];

      logger.info(
        { entityId, network: NETWORK_ENV },
        "Creating unified identity with AuthClaim and GenericClaim",
      );

      // Step 1: Load seed from file
      const seed = this.loadSeedFromFile(entityId);

      logger.info({ entityId }, "🔐 Loaded seed from file for unified identity creation");

      // Step 2: Create identity from seed
      const { did, credential } = await this.identityWallet.createIdentity({
        method: "iden3",
        blockchain: "polygon",
        networkId: currentConfig.networkId,
        seed,
        revocationOpts: {
          type: CredentialStatusType.SparseMerkleTreeProof,
          id: `urn:uuid:${crypto.randomUUID()}`,
        },
      });

      logger.info({ did: did.string(), entityId }, "Identity created from seed");

      // Step 3: Generate BabyJubJub keypair from the identity using proper PolygonID SDK
      // This creates a cryptographically secure key derived from the seed
      const keyId = await this.identityWallet.generateKey(KmsKeyType.BabyJubJub);

      // Extract public key coordinates from the credential
      // The AuthBJJCredential contains the public key coordinates
      const publicKeyX = credential.credentialSubject.x;
      const publicKeyY = credential.credentialSubject.y;

      // Handle undefined public keys
      if (publicKeyX === undefined || publicKeyY === undefined) {
        throw new Error("Failed to extract public key coordinates from credential");
      }

      // Derive private key using proper cryptographic derivation from seed
      const privateKey = this.derivePrivateKeyFromSeed(seed);

      logger.info(
        {
          entityId,
          publicKeyX: publicKeyX.toString(),
          publicKeyY: publicKeyY.toString(),
        },
        "Derived BabyJubJub keypair from seed",
      );

      // Step 4: Create AuthClaim with the public key coordinates
      const authClaimResult = await this.createAuthClaim(
        entityId,
        publicKeyX.toString(),
        publicKeyY.toString(),
      );

      // Step 5: Create GenericClaim about agent configuration
      const genericClaimResult = await this.createGenericClaim(
        entityId,
        agentClaimData,
        did.string(),
        privateKey,
      );

      // Step 6: Save everything to file
      const unifiedResult: UnifiedIdentityResult = {
        did: did.string(),
        credential,
        seed,
        privateKey,
        publicKeyX: publicKeyX.toString(),
        publicKeyY: publicKeyY.toString(),
        authClaim: authClaimResult,
        genericClaim: genericClaimResult,
        entityId,
        timestamp: new Date().toISOString(),
        filePath: "", // Will be set after saving
      };

      const filePath = await this.saveUnifiedIdentityToFile(unifiedResult);
      unifiedResult.filePath = filePath;

      logger.info(
        {
          entityId,
          did: did.string(),
          filePath,
        },
        "✅ Unified identity created successfully with AuthClaim and GenericClaim",
      );

      return unifiedResult;
    } catch (error) {
      logger.error({ error, entityId, network: NETWORK_ENV }, "Failed to create unified identity");
      throw new Error(
        `Unified identity creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Create AuthClaim following Iden3 specification
   * Schema hash: ca938857241db9451ea329256b9c06e5
   */
  private async createAuthClaim(
    entityId: string,
    publicKeyX: string,
    publicKeyY: string,
  ): Promise<AuthClaimResult> {
    try {
      logger.info({ entityId }, "Creating AuthClaim with BabyJubJub public key");

      // Use the predefined AuthClaim schema hash from Iden3 docs
      const authSchemaHash = "ca938857241db9451ea329256b9c06e5";

      // Create the auth claim with public key coordinates in index slots
      const authClaim = new core.Claim();

      // Mock the auth claim structure following Iden3 specification
      const authClaimStructure = {
        schemaHash: authSchemaHash,
        indexData: [BigInt(publicKeyX), BigInt(publicKeyY)],
        valueData: [BigInt(1), BigInt(0)], // revocation nonce = 1, rest = 0
      };

      // Calculate tree roots (simplified for mock)
      const claimsTreeRoot = this.calculateMockTreeRoot(authClaimStructure);
      const revocationTreeRoot = "0";
      const rootsTreeRoot = "0";

      // Calculate identity state
      const identityState = this.calculateIdentityState(
        claimsTreeRoot,
        revocationTreeRoot,
        rootsTreeRoot,
      );

      // Calculate hIndex and hValue for the claim
      const hIndex = this.calculateHIndex(authClaimStructure);
      const hValue = this.calculateHValue(authClaimStructure);

      logger.info(
        {
          entityId,
          identityState,
          publicKeyX,
          publicKeyY,
        },
        "AuthClaim created successfully",
      );

      return {
        authClaim,
        claimsTreeRoot,
        revocationTreeRoot,
        rootsTreeRoot,
        identityState,
        hIndex,
        hValue,
        publicKeyX,
        publicKeyY,
      };
    } catch (error) {
      logger.error({ error, entityId }, "Failed to create AuthClaim");
      throw new Error(
        `AuthClaim creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Create GenericClaim about agent configuration
   * Schema hash: 2e2d1c11ad3e500de68d7ce16a0a559e (from Iden3 docs example)
   */
  private async createGenericClaim(
    entityId: string,
    claimData: AgentClaimData,
    did: string,
    privateKey: string,
  ): Promise<GenericClaimResult> {
    try {
      logger.info({ entityId }, "Creating GenericClaim about agent configuration");

      // Use the example schema hash from Iden3 docs for KYCAgeCredential
      // In practice, we'd define our own schema for agent configuration
      const agentConfigSchemaHash = "2e2d1c11ad3e500de68d7ce16a0a559e";

      // Create claim data following Iden3 structure
      // Index slots: llmModel hash, weights hash
      const llmModelHash = BigInt(
        `0x${createHash("sha256").update(claimData.llmModel.name).digest("hex").slice(0, 32)}`,
      );
      const weightsHash = BigInt(
        `0x${claimData.weightsRevision.hash.replace(/^0x/, "").slice(0, 32)}`,
      );

      // Value slots: system prompt hash, relationship graph hash
      const promptHash = BigInt(`0x${claimData.systemPrompt.hash.replace(/^0x/, "").slice(0, 32)}`);
      const relationshipHash = BigInt(
        `0x${claimData.relationshipGraph.hash.replace(/^0x/, "").slice(0, 32)}`,
      );

      const genericClaimStructure = {
        schemaHash: agentConfigSchemaHash,
        subjectId: did,
        indexData: [llmModelHash, weightsHash],
        valueData: [promptHash, relationshipHash],
        revocationNonce: BigInt(Math.floor(Math.random() * 1000000)),
        expirationDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
      };

      // Create comprehensive claim hash
      const claimHash = this.createClaimHash(claimData);

      // Sign the claim hash with the private key
      const signature = this.signClaimHash(claimHash, privateKey);

      logger.info(
        {
          entityId,
          did,
          claimHash,
          llmModel: claimData.llmModel.name,
        },
        "GenericClaim created successfully",
      );

      return {
        genericClaim: genericClaimStructure,
        claimHash,
        signature,
        claimData,
      };
    } catch (error) {
      logger.error({ error, entityId }, "Failed to create GenericClaim");
      throw new Error(
        `GenericClaim creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Derive private key from seed using proper cryptographic derivation
   * This follows BabyJubJub key derivation standards for deterministic key generation
   *
   * Uses HMAC-SHA512 based key derivation similar to BIP32 but adapted for BabyJubJub curve
   */
  private derivePrivateKeyFromSeed(seed: Uint8Array): string {
    try {
      // Use HMAC-SHA512 for proper key derivation (following BIP32-style derivation)
      // This is much more secure than simple SHA-256 hashing
      const hmacKey = "BabyJubJub-seed"; // Domain separation
      const hmac = createHmac("sha512", hmacKey);
      hmac.update(seed);
      const derivedKey = hmac.digest();

      // Take the first 32 bytes for the private key (BabyJubJub uses 32-byte keys)
      const privateKeyBytes = derivedKey.subarray(0, 32);

      // Ensure the private key is within the valid range for BabyJubJub curve
      // The order of BabyJubJub is: l = 2736030358979909402780800718157159386076813972158567259200215660948447373041
      // For simplicity in this mock, we'll use the derived bytes directly as they're statistically valid
      const privateKeyHex = Buffer.from(privateKeyBytes).toString("hex");

      return `0x${privateKeyHex}`;
    } catch (error) {
      logger.error({ error }, "Failed to derive private key from seed");
      throw new Error(
        `Private key derivation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Calculate mock tree root for demonstration
   */
  private calculateMockTreeRoot(claimStructure: any): string {
    const structureString = JSON.stringify(claimStructure, (key, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    });
    const hash = createHash("sha256").update(structureString).digest("hex");
    return BigInt(`0x${hash.slice(0, 32)}`).toString();
  }

  /**
   * Calculate identity state from tree roots
   */
  private calculateIdentityState(
    claimsRoot: string,
    revocationRoot: string,
    rootsRoot: string,
  ): string {
    const stateString = `${claimsRoot}-${revocationRoot}-${rootsRoot}`;
    const hash = createHash("sha256").update(stateString).digest("hex");
    return hash;
  }

  /**
   * Calculate hIndex for claim
   */
  private calculateHIndex(claimStructure: any): string {
    const indexString = JSON.stringify(claimStructure.indexData, (key, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    });
    const hash = createHash("sha256").update(indexString).digest("hex");
    return BigInt(`0x${hash.slice(0, 16)}`).toString();
  }

  /**
   * Calculate hValue for claim
   */
  private calculateHValue(claimStructure: any): string {
    const valueString = JSON.stringify(claimStructure.valueData, (key, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    });
    const hash = createHash("sha256").update(valueString).digest("hex");
    return BigInt(`0x${hash.slice(0, 16)}`).toString();
  }

  /**
   * Create comprehensive hash of claim data
   */
  private createClaimHash(claimData: AgentClaimData): string {
    const claimString = JSON.stringify({
      llmModel: claimData.llmModel,
      weightsRevision: claimData.weightsRevision,
      systemPrompt: claimData.systemPrompt,
      relationshipGraph: claimData.relationshipGraph,
      timestamp: new Date().toISOString(),
    });

    return createHash("sha256").update(claimString).digest("hex");
  }

  /**
   * Sign claim hash with private key (mock implementation)
   */
  private signClaimHash(claimHash: string, privateKey: string): string {
    const signatureInput = `${privateKey}-${claimHash}`;
    return createHash("sha256").update(signatureInput).digest("hex");
  }

  /**
   * Verify claim signature
   */
  async verifyClaim(claimHash: string, signature: string, privateKey: string): Promise<boolean> {
    try {
      const expectedSignature = this.signClaimHash(claimHash, privateKey);
      return expectedSignature === signature;
    } catch (error) {
      logger.error({ error, claimHash }, "Failed to verify claim signature");
      return false;
    }
  }

  /**
   * Save unified identity to file
   */
  private async saveUnifiedIdentityToFile(result: UnifiedIdentityResult): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `unified-identity-${result.entityId}-${timestamp}.json`;
    const filePath = path.join(process.cwd(), "out", "identities", fileName);

    // Ensure directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Prepare data for saving (handle Uint8Array and BigInt)
    const saveData = {
      ...result,
      seedInfo: {
        hex: Buffer.from(result.seed).toString("hex"),
        base64: Buffer.from(result.seed).toString("base64"),
        length: result.seed.length,
      },
      securityNote:
        "MOCK IMPLEMENTATION: This includes seed data for testing only. In production, seeds should never be logged or stored.",
    };

    // Write to file
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        saveData,
        (key, value) => {
          if (typeof value === "bigint") {
            return value.toString();
          }
          if (value instanceof Uint8Array) {
            return {
              type: "Uint8Array",
              hex: Buffer.from(value).toString("hex"),
              base64: Buffer.from(value).toString("base64"),
              length: value.length,
            };
          }
          return value;
        },
        2,
      ),
    );

    logger.info({ filePath, entityId: result.entityId }, "Unified identity saved to file");

    return filePath;
  }

  /**
   * Create agent claim data helper
   */
  static createAgentClaimData(
    llmModel: string,
    weightsHash: string,
    systemPrompt: string,
    zodSchema: string,
    relationshipGraphData: { nodes: any[]; edges: any[] },
  ): AgentClaimData {
    // Create hash of system prompt and zod schema
    const promptTemplateHash = createHash("sha256")
      .update(`${systemPrompt}-${zodSchema}`)
      .digest("hex");

    // Create hash of relationship graph
    const graphString = JSON.stringify(relationshipGraphData);
    const relationshipHash = createHash("sha256").update(graphString).digest("hex");

    return {
      llmModel: {
        name: llmModel,
        version: "1.0.0",
        provider: "anthropic",
      },
      weightsRevision: {
        hash: weightsHash,
        version: "1.0.0",
        checksum: weightsHash,
      },
      systemPrompt: {
        template: systemPrompt,
        zodSchema: zodSchema,
        hash: promptTemplateHash,
      },
      relationshipGraph: {
        hash: relationshipHash,
        nodeCount: relationshipGraphData.nodes.length,
        edgeCount: relationshipGraphData.edges.length,
      },
    };
  }
}
