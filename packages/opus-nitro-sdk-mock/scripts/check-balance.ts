#!/usr/bin/env bun

/**
 * Script to check USDC balance of a wallet address
 */

import { createPublicClient, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { getUSDCBalance } from "@infinite-bazaar-demo/x402";
import { logger } from "@infinite-bazaar-demo/logs";
import dotenv from "dotenv";

dotenv.config();

async function checkBalance(address: string): Promise<void> {
  try {
    console.log(`🔍 Checking USDC balance for address: ${address}`);
    console.log(`📡 Network: Base Sepolia`);
    
    // Create public client for Base Sepolia
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    // Get USDC balance
    const balanceWei = await getUSDCBalance(publicClient, address as Address);
    const balanceUsdc = Number(balanceWei) / 1_000_000; // USDC has 6 decimals

    console.log(`💰 Balance: ${balanceUsdc} USDC`);
    console.log(`🔢 Balance (wei): ${balanceWei.toString()}`);
    
    if (balanceUsdc === 0) {
      console.log(`❌ Wallet has no USDC - needs funding from Circle faucet`);
      console.log(`🌐 Fund at: https://faucet.circle.com/`);
      console.log(`⚠️  Make sure to select Base Sepolia network`);
    } else {
      console.log(`✅ Wallet has sufficient USDC for transfers`);
    }

  } catch (error) {
    logger.error({ error, address }, "Failed to check balance");
    console.error(`❌ Error checking balance: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const address = args[0];

  if (!address) {
    console.error("❌ Error: Wallet address is required");
    console.error("\nUsage:");
    console.error("  bun run scripts/check-balance.ts <wallet-address>");
    console.error("\nExample:");
    console.error("  bun run scripts/check-balance.ts 0xB9508cF2D7631Bf92727366B7bfbaD16d5424dB5");
    process.exit(1);
  }

  if (!address.startsWith("0x") || address.length !== 42) {
    console.error("❌ Error: Invalid wallet address format");
    console.error("Address should start with 0x and be 42 characters long");
    process.exit(1);
  }

  await checkBalance(address);
}

// Run if this is the main module
main().catch((error) => {
  logger.error({ error }, "Failed to run balance check script");
  process.exit(1);
}); 