#!/usr/bin/env bun

/**
 * Script to create a new Coinbase CDP wallet and log details to file
 * 
 * This script:
 * 1. Creates a new CDP EVM account
 * 2. Logs the wallet details to out/cdp-wallets directory
 * 3. Provides wallet information for use in other scripts
 */

import { CdpClient } from "@coinbase/cdp-sdk";
import { logger } from "@infinite-bazaar-demo/logs";
import dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";

dotenv.config();

interface WalletDetails {
  address: string;
  accountId: string;
  createdAt: string;
  network: string;
  purpose: string;
  cdpConfig: {
    apiKeyId?: string;
    hasApiKeySecret: boolean;
    hasWalletSecret: boolean;
  };
}

async function createCdpWallet(): Promise<void> {
  try {
    logger.info("🚀 Creating new Coinbase CDP wallet...");

    // Validate required environment variables
    const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
    const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
    const CDP_WALLET_SECRET = process.env.CDP_WALLET_SECRET;

    if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET || !CDP_WALLET_SECRET) {
      logger.error("Missing required CDP environment variables");
      console.error("❌ Missing required environment variables:");
      console.error("  CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET");
      console.error("\nPlease set these in your .env file or environment.");
      process.exit(1);
    }

    // Initialize CDP client
    logger.info("Initializing CDP client...");
    const cdp = new CdpClient({
      apiKeyId: CDP_API_KEY_ID,
      apiKeySecret: CDP_API_KEY_SECRET,
      walletSecret: CDP_WALLET_SECRET,
    });

    // Create new EVM account
    logger.info("Creating new EVM account...");
    const account = await cdp.evm.createAccount();

    logger.info({
      address: account.address,
      accountId: account.id
    }, "✅ Created EVM account");

    console.log(`✅ Created EVM account: ${account.address}`);

    // Prepare wallet details
    const walletDetails: WalletDetails = {
      address: account.address,
      accountId: account.id,
      createdAt: new Date().toISOString(),
      network: "base-sepolia", // Default network for CDP
      purpose: "InfiniteBazaar x402 payments",
      cdpConfig: {
        apiKeyId: CDP_API_KEY_ID,
        hasApiKeySecret: !!CDP_API_KEY_SECRET,
        hasWalletSecret: !!CDP_WALLET_SECRET,
      },
    };

    // Ensure output directory exists
    const outputDir = path.join(process.cwd(), "out", "cdp-wallets");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      logger.info({ outputDir }, "Created output directory");
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `cdp-wallet-${timestamp}.json`;
    const filepath = path.join(outputDir, filename);

    // Write wallet details to file
    fs.writeFileSync(filepath, JSON.stringify(walletDetails, null, 2));

    logger.info({ filepath }, "💾 Wallet details saved to file");

    // Display summary
    console.log("\n" + "=".repeat(80));
    console.log("🏦 COINBASE CDP WALLET CREATED SUCCESSFULLY");
    console.log("=".repeat(80));
    console.log(`📍 Address: ${walletDetails.address}`);
    console.log(`🆔 Account ID: ${walletDetails.accountId}`);
    console.log(`🌐 Network: ${walletDetails.network}`);
    console.log(`📅 Created: ${walletDetails.createdAt}`);
    console.log(`📁 Saved to: ${filepath}`);
    console.log("=".repeat(80));

    console.log("\n💡 Usage Examples:");
    console.log("# Use in environment variables:");
    console.log(`export CDP_WALLET_ADDRESS="${walletDetails.address}"`);
    console.log("\n# Use in x402 payments:");
    console.log(`export X402_SERVICE_WALLET_ADDRESS="${walletDetails.address}"`);

    console.log("\n# Test the wallet with claim-cdp tool:");
    console.log("pnpm test:claim-cdp");

    console.log("\n✅ Wallet creation completed successfully!");

  } catch (error) {
    logger.error({ error }, "❌ Failed to create CDP wallet");

    console.error("\n❌ WALLET CREATION FAILED");
    console.error("=".repeat(80));
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

    if (error instanceof Error && error.message.includes('API')) {
      console.error("\n🔧 Troubleshooting:");
      console.error("1. Verify CDP API credentials are correct");
      console.error("2. Check CDP account has sufficient permissions");
      console.error("3. Ensure network connectivity to CDP services");
      console.error("4. Verify CDP_WALLET_SECRET is valid");
    }

    console.error("=".repeat(80));
    process.exit(1);
  }
}

async function listExistingWallets(): Promise<void> {
  try {
    const walletsDir = path.join(process.cwd(), "out", "cdp-wallets");

    if (!fs.existsSync(walletsDir)) {
      console.log("📁 No existing wallets found (directory doesn't exist)");
      return;
    }

    const walletFiles = fs.readdirSync(walletsDir)
      .filter(file => file.endsWith('.json'))
      .sort();

    if (walletFiles.length === 0) {
      console.log("📁 No existing wallets found");
      return;
    }

    console.log(`\n📁 Found ${walletFiles.length} existing wallet(s):`);
    console.log("-".repeat(80));

    for (const file of walletFiles) {
      try {
        const filepath = path.join(walletsDir, file);
        const walletData = JSON.parse(fs.readFileSync(filepath, 'utf8')) as WalletDetails;

        console.log(`📄 ${file}`);
        console.log(`   Address: ${walletData.address}`);
        console.log(`   Created: ${walletData.createdAt}`);
        console.log(`   Purpose: ${walletData.purpose}`);
        console.log("");
      } catch (error) {
        console.log(`❌ ${file} (corrupted)`);
      }
    }
  } catch (error) {
    logger.warn({ error }, "Failed to list existing wallets");
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'list') {
    console.log("📋 Listing existing CDP wallets...");
    await listExistingWallets();
    return;
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log("🏦 CDP Wallet Creation Script");
    console.log("\nUsage:");
    console.log("  bun run scripts/create-cdp-wallet.ts        # Create new wallet");
    console.log("  bun run scripts/create-cdp-wallet.ts list   # List existing wallets");
    console.log("  bun run scripts/create-cdp-wallet.ts help   # Show this help");
    console.log("\nEnvironment Variables Required:");
    console.log("  CDP_API_KEY_ID      - Your CDP API key ID");
    console.log("  CDP_API_KEY_SECRET  - Your CDP API key secret");
    console.log("  CDP_WALLET_SECRET   - Your CDP wallet secret");
    return;
  }

  // Default action: create wallet
  console.log("🏦 Starting CDP wallet creation...\n");
  await listExistingWallets();
  await createCdpWallet();
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection in CDP wallet creation');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught Exception in CDP wallet creation');
  process.exit(1);
});

// Run if this is the main module
main().catch((error) => {
  logger.error({ error }, "Failed to run CDP wallet creation script");
  process.exit(1);
}); 