import { logger } from "@infinite-bazaar-demo/logs";

// Mock CDP Account interface
interface MockCdpAccount {
  name: string;
  id: string;
  address?: string;
  privateKey?: string;
  publicKey?: string;
  sign?: (data: any) => Promise<string>;
}

// Mock CDP Wallet interface
interface MockCdpWallet {
  id: string;
  name: string;
  defaultAddress?: MockCdpAccount;
  createAddress?: () => Promise<MockCdpAccount>;
  getAddress?: (addressId: string) => Promise<MockCdpAccount>;
  listAddresses?: () => Promise<MockCdpAccount[]>;
}

// Mock CDP User interface
interface MockCdpUser {
  id: string;
  createWallet?: (name: string) => Promise<MockCdpWallet>;
  getWallet?: (walletId: string) => Promise<MockCdpWallet>;
  listWallets?: () => Promise<MockCdpWallet[]>;
}

// Mock CDP Client for testing
class MockCdpClient {
  private mockWallets: Map<string, MockCdpWallet> = new Map();
  private mockUsers: Map<string, MockCdpUser> = new Map();

  evm = {
    getOrCreateAccount: async ({ name }: { name: string }): Promise<MockCdpAccount> => {
      logger.info({ name }, "🧪 MOCK: Creating CDP account (test mode)");

      // Generate a deterministic mock address based on the name
      const mockAddress = `0x${Buffer.from(name).toString("hex").padEnd(40, "0").slice(0, 40)}`;

      return {
        name,
        id: `mock-account-${name}`,
        address: mockAddress,
        privateKey: "0x" + "a".repeat(64), // Mock private key
        publicKey: "0x" + "b".repeat(128), // Mock public key
        sign: async (data: any) => {
          logger.info({ data }, "🧪 MOCK: Signing data (test mode)");
          return "0x" + "c".repeat(130); // Mock signature
        },
      };
    },
  };

  // Mock user management
  async createUser(userId: string): Promise<MockCdpUser> {
    logger.info({ userId }, "🧪 MOCK: Creating CDP user (test mode)");

    const mockUser: MockCdpUser = {
      id: userId,
      createWallet: async (name: string) => {
        const walletId = `mock-wallet-${name}-${Date.now()}`;
        const mockWallet: MockCdpWallet = {
          id: walletId,
          name,
          defaultAddress: await this.evm.getOrCreateAccount({ name: `${name}-default` }),
          createAddress: async () => {
            return await this.evm.getOrCreateAccount({ name: `${name}-${Date.now()}` });
          },
          getAddress: async (addressId: string) => {
            return await this.evm.getOrCreateAccount({ name: `${name}-${addressId}` });
          },
          listAddresses: async () => {
            return [await this.evm.getOrCreateAccount({ name: `${name}-default` })];
          },
        };

        this.mockWallets.set(walletId, mockWallet);
        logger.info({ walletId, name }, "🧪 MOCK: Created CDP wallet (test mode)");
        return mockWallet;
      },
      getWallet: async (walletId: string) => {
        const wallet = this.mockWallets.get(walletId);
        if (!wallet) {
          throw new Error(`Mock wallet ${walletId} not found`);
        }
        return wallet;
      },
      listWallets: async () => {
        return Array.from(this.mockWallets.values());
      },
    };

    this.mockUsers.set(userId, mockUser);
    return mockUser;
  }

  async getUser(userId: string): Promise<MockCdpUser> {
    const user = this.mockUsers.get(userId);
    if (!user) {
      throw new Error(`Mock user ${userId} not found`);
    }
    return user;
  }

  // Mock transaction methods
  async simulateTransaction(params: {
    from: string;
    to: string;
    value?: string;
    data?: string;
  }): Promise<{
    hash: string;
    status: "success" | "failed";
    gasUsed: number;
    blockNumber: number;
  }> {
    logger.info(params, "🧪 MOCK: Simulating transaction (test mode)");

    const mockHash = `0x${Math.random().toString(16).substring(2, 66)}`;

    return {
      hash: mockHash,
      status: "success",
      gasUsed: Math.floor(Math.random() * 100000) + 21000,
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
    };
  }

  async getTransactionReceipt(hash: string): Promise<{
    hash: string;
    status: "success" | "failed";
    gasUsed: number;
    blockNumber: number;
    confirmations: number;
  }> {
    logger.info({ hash }, "🧪 MOCK: Getting transaction receipt (test mode)");

    return {
      hash,
      status: "success",
      gasUsed: Math.floor(Math.random() * 100000) + 21000,
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
      confirmations: Math.floor(Math.random() * 10) + 1,
    };
  }
}

/**
 * Factory function to create CDP client - returns mock in test mode
 */
export function createCdpClient(config: {
  apiKeyName: string;
  privateKey: string;
}): any {
  if (process.env.NODE_ENV === "test" || process.env.MOCK_CDP_WALLET === "true") {
    logger.info("🧪 Creating MOCK CDP client for test environment");
    return new MockCdpClient();
  }

  logger.info("🔑 Creating REAL CDP client for production environment");

  // Import the real Coinbase SDK only in production
  const { Coinbase } = require("@coinbase/coinbase-sdk");
  return Coinbase.configure(config);
}

// Mock viem account converter for testing
export function createMockViemAccount(cdpAccount: MockCdpAccount) {
  if (process.env.NODE_ENV === "test" || process.env.MOCK_CDP_WALLET === "true") {
    logger.info(
      { accountName: cdpAccount.name },
      "🧪 MOCK: Converting to viem account (test mode)",
    );
    return {
      address:
        cdpAccount.address ||
        `0x${Buffer.from(cdpAccount.name).toString("hex").padEnd(40, "0").slice(0, 40)}`,
      publicKey: cdpAccount.publicKey || "0x" + "b".repeat(128),
      signMessage: async (message: any) => {
        logger.info({ message }, "🧪 MOCK: Signing message (test mode)");
        return "0x" + "d".repeat(130);
      },
      signTransaction: async (transaction: any) => {
        logger.info({ transaction }, "🧪 MOCK: Signing transaction (test mode)");
        return "0x" + "e".repeat(130);
      },
      signTypedData: async (typedData: any) => {
        logger.info({ typedData }, "🧪 MOCK: Signing typed data (test mode)");
        return "0x" + "f".repeat(130);
      },
    };
  }

  // In production, use the real toAccount function
  const { toAccount } = require("viem/accounts");
  return toAccount(cdpAccount as any);
}

/**
 * Mock CDP wallet creation for testing
 */
export async function createMockWallet(name: string): Promise<MockCdpWallet> {
  if (process.env.NODE_ENV !== "test" && process.env.MOCK_CDP_WALLET !== "true") {
    throw new Error("Mock wallet creation is only available in test mode");
  }

  logger.info({ name }, "🧪 MOCK: Creating CDP wallet (test mode)");

  const mockClient = new MockCdpClient();
  const user = await mockClient.createUser("test-user");
  return await user.createWallet!(name);
}

export { MockCdpClient };
export type { MockCdpAccount, MockCdpWallet, MockCdpUser };
