import { CdpClient } from "@coinbase/cdp-sdk";
import { db, entities, eq } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";
import type { LocalAccount } from "viem";
import { toAccount } from "viem/accounts";
import type { ToolCallResult } from "../../../../types/message.js";

/**
 * Sanitize name for CDP account usage
 * - Convert to lowercase
 * - Replace spaces with underscores
 * - Strip special characters (keep only alphanumeric and underscores)
 */
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Check if CDP name already exists in database
 */
async function isCdpNameTaken(cdpName: string): Promise<boolean> {
  const existingEntities = await db
    .select()
    .from(entities)
    .where(eq(entities.cdp_name, cdpName))
    .limit(1);

  return existingEntities.length > 0;
}

/**
 * Generate unique CDP name by appending numbers if needed
 */
async function generateUniqueCdpName(baseName: string): Promise<string> {
  let cdpName = baseName;
  let counter = 1;

  while (await isCdpNameTaken(cdpName)) {
    cdpName = `${baseName}_${counter}`;
    counter++;
  }

  return cdpName;
}

/**
 * Handle create name - sets up agent name and CDP wallet
 *
 * This function:
 * 1. Validates and sanitizes the name
 * 2. Ensures CDP name uniqueness
 * 3. Creates CDP client and account
 * 4. Updates the entities table with name and CDP info
 * 5. Returns the wallet address and account details
 */
export async function handleCreateName(input: Record<string, any>): Promise<ToolCallResult> {
  const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
  const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
  const CDP_WALLET_SECRET = process.env.CDP_WALLET_SECRET;

  try {
    logger.info({ input }, "Starting name creation process with CDP SDK");

    // Extract name and entity_id from input
    const { name, entity_id } = input;

    if (!name || typeof name !== "string") {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "name is required and must be a string",
        },
        name: "create_name",
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
        name: "create_name",
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
        name: "create_name",
      };
    }

    // Check if entity already has a name - shortcut if it does
    const existingEntity = await db
      .select()
      .from(entities)
      .where(eq(entities.entityId, entity_id))
      .limit(1);

    if (existingEntity.length > 0 && existingEntity[0]!.name) {
      const entity = existingEntity[0]!; // We know it exists because we checked length above
      logger.info(
        { entity_id, existingName: entity.name },
        "Entity already has a name, returning existing info",
      );
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: true,
          message: "Name already exists, returning existing information",
          name: entity.name,
          cdpName: entity.cdp_name,
          walletAddress: entity.cdp_address,
          cdpAccount: {
            name: entity.cdp_name,
            address: entity.cdp_address,
          },
          alreadyExisted: true,
          timestamp: new Date().toISOString(),
        },
        name: "create_name",
      };
    }

    // Sanitize the name for CDP usage and ensure uniqueness
    const baseCdpName = sanitizeName(name);
    const uniqueCdpName = await generateUniqueCdpName(baseCdpName);

    logger.info(
      {
        originalName: name,
        baseCdpName,
        uniqueCdpName,
      },
      "Generated unique CDP name",
    );

    // Initialize CDP client and create account
    logger.info("Initializing Coinbase CDP client...");
    const cdpClient = new CdpClient({
      apiKeyId: CDP_API_KEY_ID,
      apiKeySecret: CDP_API_KEY_SECRET,
      walletSecret: CDP_WALLET_SECRET,
    });

    logger.info({ uniqueCdpName }, "Creating CDP account...");
    const cdpAccount = await cdpClient.evm.getOrCreateAccount({
      name: uniqueCdpName,
    });

    logger.info(
      {
        accountName: cdpAccount.name,
        accountId: (cdpAccount as any).id || "unknown",
      },
      "CDP account created successfully",
    );

    // Convert CDP account to viem LocalAccount to get address
    const viemAccount = toAccount<LocalAccount>(cdpAccount as any);

    logger.info(
      {
        accountAddress: viemAccount.address,
      },
      "Converted CDP account to viem account",
    );

    // Update the entities table with name and CDP account info
    try {
      await db
        .update(entities)
        .set({
          name: name, // Save the original name
          cdp_name: cdpAccount.name,
          cdp_address: viemAccount.address,
        })
        .where(eq(entities.entityId, entity_id));

      logger.info(
        {
          entity_id,
          name,
          cdp_name: cdpAccount.name,
          cdp_address: viemAccount.address,
        },
        "Updated entities table with name and CDP account info",
      );
    } catch (dbError) {
      logger.error(
        { dbError, entity_id },
        "Failed to update entities table with name and CDP info",
      );
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Failed to update database with name and CDP account information",
          details: dbError instanceof Error ? dbError.message : "Unknown database error",
        },
        name: "create_name",
      };
    }

    // Return success result
    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: true,
        message: "Name and CDP wallet created successfully",
        name: name,
        cdpName: cdpAccount.name,
        walletAddress: viemAccount.address,
        cdpAccount: {
          name: cdpAccount.name,
          id: (cdpAccount as any).id || "unknown",
          address: viemAccount.address,
        },
        timestamp: new Date().toISOString(),
      },
      name: "create_name",
    };
  } catch (error) {
    logger.error({ error, input }, "Name creation failed");

    let errorMessage = "Unknown error occurred during name creation";
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
      name: "create_name",
    };
  }
}
