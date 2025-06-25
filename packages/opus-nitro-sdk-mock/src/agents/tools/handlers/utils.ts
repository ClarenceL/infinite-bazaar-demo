import { CdpClient } from "@coinbase/cdp-sdk";
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

// Mock CDP Client for testing
class MockCdpClient {
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
}

/**
 * Factory function to create CDP client - returns mock in test mode
 */
export function createCdpClient(config: {
  apiKeyId: string;
  apiKeySecret: string;
  walletSecret: string;
}): CdpClient | MockCdpClient {
  if (process.env.NODE_ENV === "test") {
    logger.info("🧪 Creating MOCK CDP client for test environment");
    return new MockCdpClient() as any;
  }

  logger.info("🔑 Creating REAL CDP client for production environment");
  return new CdpClient(config);
}

// Mock viem account converter for testing
export function createMockViemAccount(cdpAccount: MockCdpAccount) {
  if (process.env.NODE_ENV === "test") {
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
 * Processes an API response and handles different response types and error states
 * consistently across all tool handlers
 *
 * @param response The fetch Response object to process
 * @returns An object with the processed data and any error information
 */
export async function processApiResponse(response: Response): Promise<{
  data: any;
  error?: string;
  statusCode: number;
  statusText: string;
  isSuccess: boolean;
}> {
  const statusCode = response.status;
  const statusText = response.statusText;
  const isSuccess = response.ok;
  let data: any = {};
  let error: string | undefined = undefined;

  // For successful responses, attempt to parse as JSON
  if (response.ok) {
    try {
      data = await response.json();
    } catch (e) {
      // If not JSON, get as text
      try {
        const textResponse = await response.text();
        data = { message: textResponse };
      } catch (textError) {
        // If all else fails, create a generic success response
        data = { message: "Operation completed successfully" };
      }
    }
    return { data, statusCode, statusText, isSuccess };
  }

  // For non-OK responses, handle by content type
  const contentType = response.headers.get("content-type") || "";

  // Simple text responses (like "404 Not Found")
  if (contentType.includes("text/plain")) {
    const textResponse = await response.text();
    console.log(`Plain text error response: ${textResponse}`);
    error = `API request failed: ${statusCode} ${statusText} - ${textResponse}`;
    data = { error };
  }
  // JSON error responses
  else if (contentType.includes("application/json")) {
    try {
      data = await response.json();
      // If the JSON response doesn't have an error field, add one
      if (!data.error) {
        error = `API request failed with status: ${statusCode} ${statusText}`;
        data.error = error;
      } else {
        error = data.error;
      }
    } catch (parseError) {
      console.error("Error parsing JSON error response:", parseError);
      error = `API request failed with status ${statusCode} ${statusText} (JSON parse error)`;
      data = { error };
    }
  }
  // Other response types
  else {
    try {
      const textResponse = await response.text();
      console.log(`Non-JSON response (${contentType}): ${textResponse.substring(0, 100)}...`);
      error = `API request failed with status: ${statusCode} ${statusText}`;
      data = {
        error,
        responseText:
          textResponse.length > 500 ? `${textResponse.substring(0, 500)}...` : textResponse,
      };
    } catch (e) {
      // Don't let this fail
      error = `API request failed with status: ${statusCode} ${statusText}`;
      data = { error };
    }
  }

  return { data, error, statusCode, statusText, isSuccess };
}
