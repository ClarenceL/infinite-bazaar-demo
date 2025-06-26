import { createHash } from "node:crypto";
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

// Network configuration - using testnet for development
const NETWORK_CONFIG = {
  rpcUrl: "https://rpc-amoy.polygon.technology/",
  contractAddress: "0x1a4cC30f2aA0377b0c3bc9848766D90cb4404124", // Amoy testnet State contract
  chainId: 80002,
  networkId: "amoy",
  networkName: "amoy",
};

/**
 * Interface for the four types of claims we need to sign
 */
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

/**
 * Result of generic claim creation following Iden3 documentation
 */
export interface GenericClaimResult {
  did: string;
  credential: W3CCredential;
  genericClaim: any; // The actual Iden3 generic claim object
  claimHash: string;
  signature: string;
  timestamp: string;
  agentId: string;
  claimData: AgentClaimData;
}

/**
 * Service for creating DIDs and signing claims in a mocked AWS Nitro Enclave environment
 * Uses the MOCK_AWS_NITRO_PRIV_KEY environment variable to simulate secure key management
 */
export class NitroDIDService {
  private identityWallet: IdentityWallet;
  private credentialWallet: CredentialWallet;
  private dataStorage: IDataStorage;
  private mockNitroPrivateKey: string;

  constructor() {
    // Validate required environment variable
    this.mockNitroPrivateKey = process.env.MOCK_AWS_NITRO_PRIV_KEY || "";
    if (!this.mockNitroPrivateKey) {
      throw new Error("MOCK_AWS_NITRO_PRIV_KEY environment variable is required");
    }

    this.dataStorage = this.initDataStorage();
    this.credentialWallet = this.initCredentialWallet(this.dataStorage);
    this.identityWallet = this.initIdentityWallet(this.dataStorage, this.credentialWallet);

    logger.info("NitroDIDService initialized with mock Nitro enclave private key");
  }

  private initDataStorage(): IDataStorage {
    const networkConfig = {
      ...defaultEthConnectionConfig,
      url: NETWORK_CONFIG.rpcUrl,
      contractAddress: NETWORK_CONFIG.contractAddress,
      chainId: NETWORK_CONFIG.chainId,
    };

    logger.info(
      {
        chainId: NETWORK_CONFIG.chainId,
        rpcUrl: NETWORK_CONFIG.rpcUrl,
        networkId: NETWORK_CONFIG.networkId,
      },
      "Initializing Nitro DID service data storage",
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
  ): IdentityWallet {
    const memoryKeyStore = new InMemoryPrivateKeyStore();
    const bjjProvider = new BjjProvider(KmsKeyType.BabyJubJub, memoryKeyStore);
    const kms = new KMS();
    kms.registerKeyProvider(KmsKeyType.BabyJubJub, bjjProvider);

    return new IdentityWallet(kms, dataStorage, credentialWallet);
  }

  /**
   * Create a generic claim following Iden3 documentation
   * Uses existing identity or creates new one if not provided
   */
  async createGenericClaim(
    agentId: string,
    claimData: AgentClaimData,
    existingIdentity?: { did: string; credential: W3CCredential },
  ): Promise<GenericClaimResult> {
    try {
      logger.info({ agentId }, "Creating generic claim with agent configuration data");

      let did: core.DID;
      let credential: W3CCredential;

      if (existingIdentity) {
        // Use existing identity
        logger.info({ agentId }, "Using existing identity for generic claim");
        // Convert string DID back to core.DID if needed
        did = core.DID.parse(existingIdentity.did);
        credential = existingIdentity.credential;
      } else {
        // Create new identity if none provided
        logger.info({ agentId }, "Creating new identity for generic claim");
        const seed = this.createDeterministicSeed(agentId);

        const identityResult = await this.identityWallet.createIdentity({
          method: "iden3",
          blockchain: "polygon",
          networkId: NETWORK_CONFIG.networkId,
          seed,
          revocationOpts: {
            type: CredentialStatusType.SparseMerkleTreeProof,
            id: `urn:uuid:${crypto.randomUUID()}`,
          },
        });

        did = identityResult.did;
        credential = identityResult.credential;
      }

      logger.info({ did: did.string(), agentId }, "Identity ready for generic claim creation");

      // Create generic claim following Iden3 documentation pattern
      // Schema hash for agent configuration claim (custom schema)
      const agentConfigSchemaHash = "2e2d1c11ad3e500de68d7ce16a0a559e";

      // Prepare claim data slots following the documentation pattern
      // Index data: llmModel hash, weights hash
      const llmModelHash = BigInt(
        `0x${createHash("sha256").update(claimData.llmModel.name).digest("hex").slice(0, 32)}`,
      );

      // Clean the weights hash - remove 0x prefix if present, then take first 32 hex chars
      const cleanWeightsHash = claimData.weightsRevision.hash.replace(/^0x/, "").slice(0, 32);
      const weightsHash = BigInt(`0x${cleanWeightsHash}`);

      // Value data: system prompt hash, relationship graph hash
      const cleanPromptHash = claimData.systemPrompt.hash.replace(/^0x/, "").slice(0, 32);
      const promptHash = BigInt(`0x${cleanPromptHash}`);

      const cleanRelationshipHash = claimData.relationshipGraph.hash
        .replace(/^0x/, "")
        .slice(0, 32);
      const relationshipHash = BigInt(`0x${cleanRelationshipHash}`);

      // Set claim expiration date (far future)
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 10);

      // Set revocation nonce
      const revocationNonce = BigInt(Math.floor(Math.random() * 1000000));

      // Create the generic claim using the core SDK
      const genericClaim = new core.Claim();

      // This is a simplified approach - in reality we'd use proper core.NewClaim API
      // but we'll create a mock claim object that represents the structure
      const claimStructure = {
        schemaHash: agentConfigSchemaHash,
        indexData: [llmModelHash, weightsHash],
        valueData: [promptHash, relationshipHash],
        revocationNonce,
        expirationDate,
        subjectId: did,
      };

      logger.info(
        {
          agentId,
          llmModelHash: llmModelHash.toString(),
          weightsHash: weightsHash.toString(),
          promptHash: promptHash.toString(),
          relationshipHash: relationshipHash.toString(),
        },
        "Created generic claim with agent configuration data",
      );

      // Create a comprehensive claim hash from all the claim data
      const claimHash = this.createClaimHash(claimData);

      // Sign the claim hash using the mock Nitro private key
      const signature = this.signClaimHash(claimHash, agentId);

      logger.info(
        {
          did: did.string(),
          claimHash,
          agentId,
          llmModel: claimData.llmModel.name,
          weightsHash: claimData.weightsRevision.hash.substring(0, 16) + "...",
          promptHash: claimData.systemPrompt.hash.substring(0, 16) + "...",
          relationshipHash: claimData.relationshipGraph.hash.substring(0, 16) + "...",
        },
        "Generic claim created successfully with agent configuration",
      );

      return {
        did: did.string(),
        credential,
        genericClaim: claimStructure,
        claimHash,
        signature,
        timestamp: new Date().toISOString(),
        agentId,
        claimData,
      };
    } catch (error) {
      logger.error({ error, agentId }, "Failed to create generic claim");
      throw new Error(
        `Generic claim creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Create a deterministic seed based on the Nitro private key and agent ID
   */
  private createDeterministicSeed(agentId: string): Uint8Array {
    const seedInput = `${this.mockNitroPrivateKey}-${agentId}`;
    const hash = createHash("sha256").update(seedInput).digest();
    return new Uint8Array(hash);
  }

  /**
   * Create a comprehensive hash of all claim data
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
   * Sign the claim hash using the mock Nitro private key
   */
  private signClaimHash(claimHash: string, agentId: string): string {
    // In a real Nitro enclave, this would use secure cryptographic signing
    // For the mock, we'll create a deterministic signature
    const signatureInput = `${this.mockNitroPrivateKey}-${claimHash}-${agentId}`;
    return createHash("sha256").update(signatureInput).digest("hex");
  }

  /**
   * Verify a claim signature
   */
  async verifyClaim(claimHash: string, signature: string, agentId: string): Promise<boolean> {
    try {
      const expectedSignature = this.signClaimHash(claimHash, agentId);
      const isValid = expectedSignature === signature;

      logger.info({ claimHash, agentId, isValid }, "Claim signature verification completed");

      return isValid;
    } catch (error) {
      logger.error({ error, claimHash, agentId }, "Failed to verify claim signature");
      return false;
    }
  }

  /**
   * Create claim data from agent configuration parameters
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
        version: "1.0.0", // TODO: Extract version from model string
        provider: "anthropic", // TODO: Extract provider from model string
      },
      weightsRevision: {
        hash: weightsHash,
        version: "1.0.0", // TODO: Extract version
        checksum: weightsHash, // Using hash as checksum for now
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
