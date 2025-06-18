import {
  BjjProvider,
  CredentialStatusType,
  CredentialWallet,
  CredentialStorage,
  CredentialStatusResolverRegistry,
  EthStateStorage,
  IdentityStorage,
  IdentityWallet,
  InMemoryDataSource,
  InMemoryMerkleTreeStorage,
  InMemoryPrivateKeyStore,
  IssuerResolver,
  KMS,
  KmsKeyType,
  RHSResolver,
  defaultEthConnectionConfig,
  type W3CCredential,
  type Identity,
  type Profile,
  type IDataStorage,
  core,
} from "@0xpolygonid/js-sdk";
import { logger } from "@infinite-bazaar-demo/logs";
import * as fs from "node:fs";
import * as path from "node:path";

// Network configuration - change this to switch between mainnet and testnet
const NETWORK_ENV: 'MAINNET' | 'TESTNET' = 'TESTNET';

// Network configurations
const NETWORK_CONFIG = {
  MAINNET: {
    rpcUrl: "https://polygon-rpc.com",
    contractAddress: "0x624ce98D2d27b20b8f8d521723Df8fC4db71D79D", // Polygon mainnet State contract
    chainId: 137,
    networkId: core.NetworkId.Main,
    networkName: 'main'
  },
  TESTNET: {
    rpcUrl: "https://rpc-amoy.polygon.technology/",
    contractAddress: "0x1a4cC30f2aA0377b0c3bc9848766D90cb4404124", // Amoy testnet State contract
    chainId: 80002,
    networkId: core.NetworkId.Amoy,
    networkName: 'amoy'
  }
};

export interface IdentityCreationResult {
  did: string;
  credential: W3CCredential;
  privateKey: string;
  keyId: string;
  filePath: string;
  timestamp: string;
}

export class IdentityService {
  private identityWallet: IdentityWallet;
  private credentialWallet: CredentialWallet;
  private dataStorage: IDataStorage;

  constructor() {
    this.dataStorage = this.initDataStorage();
    this.credentialWallet = this.initCredentialWallet(this.dataStorage);
    this.identityWallet = this.initIdentityWallet(this.dataStorage, this.credentialWallet);
  }

  private initDataStorage(): IDataStorage {
    // Get current network configuration based on NETWORK_ENV flag
    const currentConfig = NETWORK_CONFIG[NETWORK_ENV];

    const networkConfig = {
      ...defaultEthConnectionConfig,
      url: currentConfig.rpcUrl,
      contractAddress: currentConfig.contractAddress,
      chainId: currentConfig.chainId,
    };

    logger.info({
      network: NETWORK_ENV,
      chainId: currentConfig.chainId,
      rpcUrl: currentConfig.rpcUrl
    }, "Initializing data storage with network configuration");

    return {
      credential: new CredentialStorage(new InMemoryDataSource<W3CCredential>()),
      identity: new IdentityStorage(
        new InMemoryDataSource<Identity>(),
        new InMemoryDataSource<Profile>()
      ),
      mt: new InMemoryMerkleTreeStorage(40),
      states: new EthStateStorage(networkConfig),
    };
  }

  private initCredentialWallet(dataStorage: IDataStorage): CredentialWallet {
    const resolvers = new CredentialStatusResolverRegistry();
    resolvers.register(
      CredentialStatusType.SparseMerkleTreeProof,
      new IssuerResolver()
    );
    resolvers.register(
      CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
      new RHSResolver(dataStorage.states)
    );

    return new CredentialWallet(dataStorage, resolvers);
  }

  private initIdentityWallet(
    dataStorage: IDataStorage,
    credentialWallet: CredentialWallet
  ): IdentityWallet {
    const memoryKeyStore = new InMemoryPrivateKeyStore();
    const bjjProvider = new BjjProvider(KmsKeyType.BabyJubJub, memoryKeyStore);
    const kms = new KMS();
    kms.registerKeyProvider(KmsKeyType.BabyJubJub, bjjProvider);

    return new IdentityWallet(kms, dataStorage, credentialWallet);
  }

  async createIdentity(): Promise<IdentityCreationResult> {
    try {
      const currentConfig = NETWORK_CONFIG[NETWORK_ENV];

      logger.info({ network: NETWORK_ENV }, "Creating new Privado ID identity...");

      // Generate a random seed for the identity
      const seedPhrase = new Uint8Array(32);
      crypto.getRandomValues(seedPhrase);

      // Create identity with proper IdentityCreationOptions
      // Using SparseMerkleTreeProof instead of reverse proof to avoid URL validation
      const { did, credential } = await this.identityWallet.createIdentity({
        method: core.DidMethod.Iden3,
        blockchain: core.Blockchain.Polygon,
        networkId: currentConfig.networkId,
        seed: seedPhrase,
        revocationOpts: {
          type: CredentialStatusType.SparseMerkleTreeProof,
          id: `urn:uuid:${crypto.randomUUID()}`, // Use URN format instead of HTTP URL
        },
      });

      logger.info({ did: did.string(), network: NETWORK_ENV }, "Identity created successfully");

      // Generate a new key for this identity
      const keyId = await this.identityWallet.generateKey(KmsKeyType.BabyJubJub);

      // Get the private key (this is a mock implementation)
      // In a real scenario, the private key would be securely managed by the KMS
      const privateKey = this.generateMockPrivateKey();

      // Create identity data to save
      const identityData = {
        did: did.string(),
        credential,
        privateKey,
        keyId: keyId.id,
        createdAt: new Date().toISOString(),
        blockchain: 'polygon',
        networkId: currentConfig.networkName,
        method: 'iden3',
        network: NETWORK_ENV,
      };

      // Save to file
      const filePath = await this.saveIdentityToFile(identityData);

      return {
        did: did.string(),
        credential,
        privateKey,
        keyId: keyId.id,
        filePath,
        timestamp: identityData.createdAt,
      };
    } catch (error) {
      logger.error({ error, network: NETWORK_ENV }, "Failed to create identity");
      throw new Error(`Identity creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateMockPrivateKey(): string {
    // Generate a mock private key (64 hex characters)
    const chars = '0123456789abcdef';
    let result = '0x';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async saveIdentityToFile(identityData: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `identity-${timestamp}.json`;
    const filePath = path.join(process.cwd(), 'out', 'identities', fileName);

    // Ensure directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write identity data to file
    fs.writeFileSync(filePath, JSON.stringify(identityData, null, 2));

    logger.info({ filePath }, "Identity saved to file");

    return filePath;
  }

  async getIdentityFromFile(filePath: string): Promise<any> {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error({ error, filePath }, "Failed to read identity from file");
      throw new Error(`Failed to read identity file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listIdentityFiles(): Promise<string[]> {
    const identitiesDir = path.join(process.cwd(), 'out', 'identities');

    if (!fs.existsSync(identitiesDir)) {
      return [];
    }

    return fs.readdirSync(identitiesDir)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(identitiesDir, file));
  }
} 