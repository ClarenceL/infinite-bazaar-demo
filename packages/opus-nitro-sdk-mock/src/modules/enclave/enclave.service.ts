import { IdentityService, type IdentityCreationResult } from "@/services/identity-service";
import { logger } from "@infinite-bazaar-demo/logs";

export interface EnclaveInfo {
  enclave_id: string;
  pcr0: string;
  pcr1: string;
  pcr2: string;
  status: string;
  mock: boolean;
}

export interface StateSigningParams {
  state_hash?: string;
  payload?: any;
}

export interface StateSigningResult {
  success: boolean;
  signature: string;
  state_hash: string;
  signed_at: string;
  pcr_hash: string;
  mock: boolean;
}

export interface MemoryCommitmentParams {
  memory?: any;
  data?: any;
}

export interface MemoryCommitmentResult {
  success: boolean;
  commitment_hash: string;
  ipfs_cid: string;
  committed_at: string;
  memory_size: number;
  mock: boolean;
}

export interface AttestationResult {
  attestation_document: string;
  pcr_measurements: {
    pcr0: string;
    pcr1: string;
    pcr2: string;
  };
  timestamp: string;
  nonce: string;
  mock: boolean;
}

export interface MockDidCreationParams {
  [key: string]: any;
}

export interface MockDidCreationResult {
  success: boolean;
  did: string;
  state_hash: string;
  attestation_document: string;
  created_at: string;
  mock: boolean;
}

export class EnclaveService {
  private identityService: IdentityService;

  constructor() {
    this.identityService = new IdentityService();
  }

  /**
   * Get enclave information including PCR measurements
   */
  async getEnclaveInfo(): Promise<EnclaveInfo> {
    logger.info("Getting enclave information");

    return {
      enclave_id: "mock-enclave-001",
      pcr0: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      pcr1: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
      pcr2: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      status: "running",
      mock: true,
    };
  }

  /**
   * Create a real Privado ID identity
   */
  async createIdentity(): Promise<IdentityCreationResult> {
    logger.info("Creating Privado ID identity via enclave service");
    return await this.identityService.createIdentity();
  }

  /**
   * List all created identities
   */
  async listIdentities(): Promise<any[]> {
    logger.info("Listing created identities");

    try {
      const files = await this.identityService.listIdentityFiles();
      const identities = [];

      for (const file of files) {
        try {
          const identity = await this.identityService.getIdentityFromFile(file);
          identities.push({
            did: identity.did,
            keyId: identity.keyId,
            createdAt: identity.createdAt,
            filePath: file,
            blockchain: identity.blockchain,
            networkId: identity.networkId,
          });
        } catch (error) {
          logger.warn({ error, file }, "Skipping corrupted identity file");
        }
      }

      return identities;
    } catch (error) {
      logger.error({ error }, "Error listing identities");
      throw new Error(`Failed to list identities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mock DID creation (legacy endpoint)
   */
  async createMockDid(params: MockDidCreationParams): Promise<MockDidCreationResult> {
    logger.info({ params }, "Creating mock DID");

    return {
      success: true,
      did: `did:privado:polygon:main:mock${Date.now()}`,
      state_hash: `0x${Math.random().toString(16).substring(2, 66)}`,
      attestation_document: "mock_attestation_document_base64",
      created_at: new Date().toISOString(),
      mock: true,
    };
  }

  /**
   * Sign state hash
   */
  async signState(params: StateSigningParams): Promise<StateSigningResult> {
    logger.info({ params }, "Signing state hash");

    return {
      success: true,
      signature: `0x${Math.random().toString(16).substring(2, 130)}`,
      state_hash: params.state_hash || `0x${Math.random().toString(16).substring(2, 66)}`,
      signed_at: new Date().toISOString(),
      pcr_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      mock: true,
    };
  }

  /**
   * Commit memory to storage
   */
  async commitMemory(params: MemoryCommitmentParams): Promise<MemoryCommitmentResult> {
    logger.info({ params }, "Committing memory");

    return {
      success: true,
      commitment_hash: `0x${Math.random().toString(16).substring(2, 66)}`,
      ipfs_cid: `Qm${Math.random().toString(36).substring(2, 48)}`,
      committed_at: new Date().toISOString(),
      memory_size: params.memory?.length || 0,
      mock: true,
    };
  }

  /**
   * Generate attestation document
   */
  async generateAttestation(): Promise<AttestationResult> {
    logger.info("Generating attestation document");

    return {
      attestation_document: "mock_attestation_document_base64_encoded",
      pcr_measurements: {
        pcr0: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        pcr1: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
        pcr2: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      },
      timestamp: new Date().toISOString(),
      nonce: Math.random().toString(36).substring(2),
      mock: true,
    };
  }
}

// Export singleton instance
export const enclaveService = new EnclaveService(); 