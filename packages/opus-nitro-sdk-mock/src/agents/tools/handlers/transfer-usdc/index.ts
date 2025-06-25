import { CdpClient } from "@coinbase/cdp-sdk";
import { db, entities, eq } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";
import type { ToolCallResult } from "../../../../types/message.js";

/**
 * Handle USDC transfer using Coinbase CDP SDK
 *
 * This function:
 * 1. Gets the sender's CDP account from database
 * 2. Creates CDP client and retrieves account
 * 3. Executes USDC transfer to recipient address
 * 4. Returns transaction hash and result
 */
export async function handleTransferUsdc(input: Record<string, any>): Promise<ToolCallResult> {
  const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
  const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
  const CDP_WALLET_SECRET = process.env.CDP_WALLET_SECRET;

  try {
    logger.info({ input }, "Starting USDC transfer process with CDP SDK");

    // Extract parameters from input
    const { to, amount, entity_id } = input;

    // Validate required parameters
    if (!to || typeof to !== "string") {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "to address is required and must be a string",
        },
        name: "transfer_usdc",
      };
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "amount is required and must be a positive number",
        },
        name: "transfer_usdc",
      };
    }

    if (!entity_id || typeof entity_id !== "string") {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "entity_id is required and must be a string",
        },
        name: "transfer_usdc",
      };
    }

    // Validate required environment variables
    if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET || !CDP_WALLET_SECRET) {
      logger.error("CDP environment variables are required");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error:
            "CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET environment variables are required",
        },
        name: "transfer_usdc",
      };
    }

    // Step 1: Get sender's CDP account info from database
    logger.info({ entity_id }, "Retrieving sender's CDP account info from database");

    const entityResults = await db
      .select()
      .from(entities)
      .where(eq(entities.entityId, entity_id))
      .limit(1);

    if (entityResults.length === 0) {
      logger.error({ entity_id }, "Entity not found in database");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Entity not found. Please create an identity first.",
        },
        name: "transfer_usdc",
      };
    }

    const entity = entityResults[0]!; // We know it exists because we checked length above
    if (!entity.cdp_name) {
      logger.error({ entity_id }, "Entity does not have a CDP account");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Entity does not have a CDP account. Please create a name first.",
        },
        name: "transfer_usdc",
      };
    }

    // Step 2: Initialize CDP client and get account
    logger.info("Initializing Coinbase CDP client...");
    const cdpClient = new CdpClient({
      apiKeyId: CDP_API_KEY_ID,
      apiKeySecret: CDP_API_KEY_SECRET,
      walletSecret: CDP_WALLET_SECRET,
    });

    logger.info({ cdpName: entity.cdp_name }, "Retrieving CDP account...");
    const cdpAccount = await cdpClient.evm.getOrCreateAccount({
      name: entity.cdp_name,
    });

    logger.info(
      {
        accountName: cdpAccount.name,
        accountId: (cdpAccount as any).id || "unknown",
        senderAddress: entity.cdp_address,
      },
      "CDP account retrieved successfully",
    );

    // Step 3: Execute USDC transfer
    // Convert amount to smallest unit (USDC has 6 decimal places)
    const amountInSmallestUnit = BigInt(Math.floor(amount * 1_000_000));

    // Ensure 'to' address has 0x prefix
    const toAddress = to.startsWith('0x') ? to : `0x${to}`;

    logger.info(
      {
        from: entity.cdp_address,
        to: toAddress,
        amount,
        amountInSmallestUnit: amountInSmallestUnit.toString(),
        token: "usdc",
        network: "base-sepolia",
      },
      "Executing USDC transfer...",
    );

    const transferResult = await cdpAccount.transfer({
      to: toAddress as `0x${string}`,
      amount: amountInSmallestUnit,
      token: "usdc",
      network: "base-sepolia",
    });

    logger.info(
      {
        transactionHash: transferResult.transactionHash,
        from: entity.cdp_address,
        to: toAddress,
        amount,
        amountInSmallestUnit: amountInSmallestUnit.toString(),
      },
      "USDC transfer completed successfully",
    );

    // Return success result
    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: true,
        transactionHash: transferResult.transactionHash,
        from: entity.cdp_address,
        to: toAddress,
        amount,
        amountInSmallestUnit: amountInSmallestUnit.toString(),
        token: "usdc",
        network: "base-sepolia",
        message: `Successfully transferred ${amount} USDC to ${toAddress}`,
      },
      name: "transfer_usdc",
    };

  } catch (error) {
    logger.error({ error, input }, "USDC transfer failed");

    let errorMessage = "Unknown error occurred during USDC transfer";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      },
      name: "transfer_usdc",
    };
  }
} 