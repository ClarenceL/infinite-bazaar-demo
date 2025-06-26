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
 * Interface for AuthClaim creation result
 */
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

/**
 * Interface for complete identity with trees
 */
export interface IdentityWithTrees {
  identity: Identity;
  claimsTree: any; // MerkleTree from @iden3/js-merkletree-sql
  revocationTree: any; // MerkleTree from @iden3/js-merkletree-sql
  rootsTree: any; // MerkleTree from @iden3/js-merkletree-sql
  authClaimResult: AuthClaimResult;
  identityState: string;
}

/**
 * Service for creating proper Iden3 AuthClaim following the official documentation
 * This implements the pattern from https://docs.iden3.io/getting-started/identity/identity-state/#create-identity-trees-and-add-authclaim
 */
export class Iden3AuthClaimService {
  private identityWallet: IdentityWallet;
  private credentialWallet: CredentialWallet;
  private dataStorage: IDataStorage;
  private kms: KMS;

  constructor() {
    this.dataStorage = this.initDataStorage();
    this.credentialWallet = this.initCredentialWallet(this.dataStorage);
    this.kms = this.initKMS();
    this.identityWallet = this.initIdentityWallet(this.dataStorage, this.credentialWallet);

    logger.info("Iden3AuthClaimService initialized for proper AuthClaim creation");
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
      "Initializing Iden3 AuthClaim service data storage",
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

  private initKMS(): KMS {
    const memoryKeyStore = new InMemoryPrivateKeyStore();
    const bjjProvider = new BjjProvider(KmsKeyType.BabyJubJub, memoryKeyStore);
    const kms = new KMS();
    kms.registerKeyProvider(KmsKeyType.BabyJubJub, bjjProvider);
    return kms;
  }

  private initIdentityWallet(
    dataStorage: IDataStorage,
    credentialWallet: CredentialWallet,
  ): IdentityWallet {
    return new IdentityWallet(this.kms, dataStorage, credentialWallet);
  }

  /**
   * Create proper AuthClaim following Iden3 documentation pattern
   * This creates the three identity trees and adds the AuthClaim to the Claims tree
   */
  async createAuthClaimWithTrees(agentId: string): Promise<IdentityWithTrees> {
    try {
      logger.info({ agentId }, "Creating AuthClaim with proper Iden3 tree structure");

      // Step 1: Generate Baby Jubjub keypair for the AuthClaim
      const keyId = await this.identityWallet.generateKey(KmsKeyType.BabyJubJub);
      const publicKey = await this.kms.publicKeyByKeyId(keyId);

      logger.info({ keyId: keyId.id, agentId }, "Generated Baby Jubjub keypair for AuthClaim");

      // Step 2: Extract X and Y coordinates from the public key
      // The public key should be a point on the Baby Jubjub curve
      const publicKeyHex = publicKey.hex;
      
      // For Baby Jubjub, the public key is typically 64 bytes (32 bytes X + 32 bytes Y)
      // We need to extract X and Y coordinates
      const publicKeyX = publicKeyHex.slice(0, 64); // First 32 bytes (64 hex chars)
      const publicKeyY = publicKeyHex.slice(64, 128); // Second 32 bytes (64 hex chars)

      logger.info(
        {
          publicKeyX: publicKeyX.substring(0, 16) + "...",
          publicKeyY: publicKeyY.substring(0, 16) + "...",
          agentId,
        },
        "Extracted X and Y coordinates from public key",
      );

      // Step 3: Create the three identity trees (following Iden3 docs pattern)
      const { InMemoryMerkleTreeStorage: TreeStorage } = await import("@iden3/js-merkletree-sql");
      const { MerkleTree } = await import("@iden3/js-merkletree-sql");

      // Create empty Claims tree (40 levels deep as per Iden3 standard)
      const claimsTreeStorage = new TreeStorage(40);
      const claimsTree = new MerkleTree(claimsTreeStorage, true, 40);

      // Create empty Revocation tree
      const revocationTreeStorage = new TreeStorage(40);
      const revocationTree = new MerkleTree(revocationTreeStorage, true, 40);

      // Create empty Roots tree
      const rootsTreeStorage = new TreeStorage(40);
      const rootsTree = new MerkleTree(rootsTreeStorage, true, 40);

      logger.info({ agentId }, "Created three empty Merkle trees for identity");

      // Step 4: Create AuthClaim following the documentation pattern
      const authClaim = core.NewClaim(
        core.AuthSchemaHash, // Use the standard Auth schema hash
        core.WithIndexDataInts(BigInt(`0x${publicKeyX}`), BigInt(`0x${publicKeyY}`)), // X, Y coordinates
        core.WithRevocationNonce(0), // Start with revocation nonce 0
      );

      logger.info({ agentId }, "Created AuthClaim with public key coordinates");

      // Step 5: Get the Index and Value of the authClaim (following docs pattern)
      const [hIndex, hValue] = authClaim.HiHv();

      // Step 6: Add auth claim to claims tree with value hValue at index hIndex
      await claimsTree.add(hIndex, hValue);

      logger.info(
        {
          hIndex: hIndex.toString(),
          hValue: hValue.toString(),
          agentId,
        },
        "Added AuthClaim to Claims tree",
      );

      // Step 7: Get the tree roots
      const claimsTreeRoot = await claimsTree.root();
      const revocationTreeRoot = await revocationTree.root();
      const rootsTreeRoot = await rootsTree.root();

      logger.info(
        {
          claimsTreeRoot: claimsTreeRoot.toString(),
          revocationTreeRoot: revocationTreeRoot.toString(),
          rootsTreeRoot: rootsTreeRoot.toString(),
          agentId,
        },
        "Retrieved tree roots",
      );

      // Step 8: Calculate Identity State as hash of the three roots (following docs)
      const { HashElems } = await import("@iden3/js-merkletree-sql");
      const identityState = HashElems([claimsTreeRoot, revocationTreeRoot, rootsTreeRoot]);

      logger.info(
        {
          identityState: identityState.toString(),
          agentId,
        },
        "Calculated Identity State as hash of three tree roots",
      );

      // Step 9: Create a proper Identity object using the IdentityWallet
      const seed = this.createDeterministicSeed(agentId);
      const { did, credential } = await this.identityWallet.createIdentity({
        method: "iden3",
        blockchain: "polygon",
        networkId: NETWORK_CONFIG.networkId,
        seed,
        revocationOpts: {
          type: CredentialStatusType.SparseMerkleTreeProof,
          id: `urn:uuid:${crypto.randomUUID()}`,
        },
      });

      // Get the Identity object from the wallet
      const identity = await this.identityWallet.getIdentity(did);

      const authClaimResult: AuthClaimResult = {
        authClaim,
        claimsTreeRoot: claimsTreeRoot.toString(),
        revocationTreeRoot: revocationTreeRoot.toString(),
        rootsTreeRoot: rootsTreeRoot.toString(),
        identityState: identityState.toString(),
        hIndex: hIndex.toString(),
        hValue: hValue.toString(),
        publicKeyX,
        publicKeyY,
      };

      logger.info(
        {
          did: did.string(),
          identityState: identityState.toString(),
          agentId,
        },
        "Successfully created AuthClaim with proper Iden3 tree structure",
      );

      return {
        identity,
        claimsTree,
        revocationTree,
        rootsTree,
        authClaimResult,
        identityState: identityState.toString(),
      };
    } catch (error) {
      logger.error({ error, agentId }, "Failed to create AuthClaim with trees");
      throw new Error(
        `AuthClaim creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Create a deterministic seed for identity creation
   */
  private createDeterministicSeed(agentId: string): Uint8Array {
    const mockNitroPrivateKey = process.env.MOCK_AWS_NITRO_PRIV_KEY || "default-mock-key";
    const seedString = `${mockNitroPrivateKey}-${agentId}-seed`;
    const hash = createHash("sha256").update(seedString).digest();
    return new Uint8Array(hash);
  }

  /**
   * Verify the AuthClaim and tree structure
   */
  async verifyAuthClaim(
    identityWithTrees: IdentityWithTrees,
    agentId: string,
  ): Promise<boolean> {
    try {
      logger.info({ agentId }, "Verifying AuthClaim and tree structure");

      const { authClaimResult, claimsTree } = identityWithTrees;

      // Verify that the AuthClaim exists in the Claims tree
      const proof = await claimsTree.generateProof(
        BigInt(authClaimResult.hIndex),
        authClaimResult.claimsTreeRoot,
      );

      const isValid = await claimsTree.verifyProof(
        authClaimResult.claimsTreeRoot,
        proof,
        BigInt(authClaimResult.hIndex),
        BigInt(authClaimResult.hValue),
      );

      if (isValid) {
        logger.info({ agentId }, "AuthClaim verification successful");
      } else {
        logger.error({ agentId }, "AuthClaim verification failed");
      }

      return isValid;
    } catch (error) {
      logger.error({ error, agentId }, "Error during AuthClaim verification");
      return false;
    }
  }
} 