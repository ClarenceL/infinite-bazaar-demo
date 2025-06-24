import { CdpClient } from "@coinbase/cdp-sdk";
import { db, entities, eq } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";
import { getUSDCBalance } from "@infinite-bazaar-demo/x402";
import { http, createPublicClient } from "viem";
import type { Address } from "viem";
import { baseSepolia } from "viem/chains";
import { OPUS_ENTITY_ID, getPromptForEntity } from "../prompts";

// Re-export OPUS_ENTITY_ID for backward compatibility
export { OPUS_ENTITY_ID };

// Cache for entity ID to CDP name mapping
const entityCdpNameCache = new Map<string, string | null>();

/**
 * Template replacement interface
 */
interface TemplateContext {
  name?: string;
  current_timestamp?: string;
  wallet_address?: string;
  balance?: string;
  balance_message?: string;
  entity_id?: string;
}

/**
 * Replace template variables in the system prompt
 */
function replaceTemplateVariables(prompt: string, context: TemplateContext): string {
  let result = prompt;

  // Replace timestamp
  const timestamp = context.current_timestamp || new Date().toISOString();
  result = result.replace(/\{\{current_timestamp\}\}/g, timestamp);

  // Replace wallet address
  const walletAddress = context.wallet_address || "0x...pending";
  result = result.replace(/\{\{wallet_address\}\}/g, walletAddress);

  // Replace balance
  const balance = context.balance || "0.00";
  result = result.replace(/\{\{balance\}\}/g, balance);

  // Replace balance message
  const balanceMessage = context.balance_message || "";
  result = result.replace(/\{\{balance_message\}\}/g, balanceMessage);

  // Replace entity ID
  const entityId = context.entity_id || "unknown";
  result = result.replace(/\{\{entity_id\}\}/g, entityId);

  // Replace name
  const name = context.name || "Unnamed - (Call create_identity tool to set your name)";
  result = result.replace(/\{\{name\}\}/g, name);

  return result;
}

/**
 * Get CDP name from database with caching
 */
async function getCdpNameForEntity(entityId: string): Promise<string | null> {
  // Check cache first
  if (entityCdpNameCache.has(entityId)) {
    return entityCdpNameCache.get(entityId) || null;
  }

  try {
    logger.info({ entityId }, "Fetching CDP name from database");

    const entity = await db
      .select({ cdpName: entities.cdp_name })
      .from(entities)
      .where(eq(entities.entityId, entityId))
      .limit(1);

    const cdpName = entity[0]?.cdpName || null;

    // Only cache non-null results - keep querying until CDP name is set
    if (cdpName) {
      entityCdpNameCache.set(entityId, cdpName);
      logger.info({ entityId, cdpName }, "CDP name retrieved and cached");
    } else {
      logger.info({ entityId }, "No CDP name found, will retry on next call");
    }

    return cdpName;
  } catch (error) {
    logger.error({ error, entityId }, "Failed to fetch CDP name from database");
    return null;
  }
}

/**
 * Get CDP wallet data (balance and address) in a single call
 */
async function getCdpWalletData(cdpName: string): Promise<{ balance: string; address: string }> {
  try {
    const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
    const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
    const CDP_WALLET_SECRET = process.env.CDP_WALLET_SECRET;

    if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET || !CDP_WALLET_SECRET) {
      logger.warn("CDP environment variables not configured, using defaults");
      return { balance: "0.00", address: "0x...pending" };
    }

    // Initialize CDP client
    const cdpClient = new CdpClient({
      apiKeyId: CDP_API_KEY_ID,
      apiKeySecret: CDP_API_KEY_SECRET,
      walletSecret: CDP_WALLET_SECRET,
    });

    // Get CDP account (single call)
    const cdpAccount = await cdpClient.evm.getOrCreateAccount({
      name: cdpName,
    });

    // Create public client for Base Sepolia
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    // Get USDC balance
    const balanceWei = await getUSDCBalance(publicClient, cdpAccount.address as Address);

    // Convert from wei to USDC (6 decimals)
    const balanceUsdc = Number(balanceWei) / 1_000_000;

    logger.info(
      {
        cdpName,
        address: cdpAccount.address,
        balanceWei: balanceWei.toString(),
        balanceUsdc,
      },
      "Retrieved CDP wallet data",
    );

    return {
      balance: balanceUsdc.toFixed(2),
      address: cdpAccount.address,
    };
  } catch (error) {
    logger.error({ error, cdpName }, "Failed to get CDP wallet data, using defaults");
    return { balance: "0.00", address: "0x...pending" };
  }
}

/**
 * Get system message with context for any agent entity
 */
export async function getSystemMessage(
  entityId: string,
  templateContext?: TemplateContext,
): Promise<string> {
  if (!entityId) {
    throw new Error("entityId is required");
  }

  logger.info({ entityId }, "Getting system message for agent");

  // Get the system prompt for this entity
  const systemPrompt = getPromptForEntity(entityId);
  if (!systemPrompt) {
    throw new Error(`No system prompt found for entity ID: ${entityId}`);
  }

  // Get CDP name from database
  const cdpName = await getCdpNameForEntity(entityId);

  let walletData = { balance: "0.00", address: "0x...pending" };
  let balanceMessage = "";

  // Only fetch wallet data if we have a CDP name
  if (cdpName) {
    logger.info({ entityId, cdpName }, "CDP name found, fetching wallet data");
    walletData = await getCdpWalletData(cdpName);
    balanceMessage = "USDC (use this wisely)";
  } else {
    logger.info({ entityId }, "No CDP name found, skipping wallet data retrieval");
    balanceMessage = "You will be given a starting balance after you create your identity";
  }

  const context: TemplateContext = {
    current_timestamp: new Date().toISOString(),
    wallet_address: walletData.address,
    balance: walletData.balance,
    balance_message: balanceMessage,
    entity_id: entityId,
    ...templateContext,
  };

  const finalSystemMessage = replaceTemplateVariables(systemPrompt, context);

  return finalSystemMessage;
}
