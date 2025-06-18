#!/usr/bin/env node

/**
 * Environment-aware migration script
 * Usage: node scripts/migrate-env.js [staging|production] [push|generate|up|studio] [additional args]
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get environment and command from arguments
const env = process.argv[2] || "development";
const command = process.argv[3] || "push";
// Capture any additional arguments after the command
const additionalArgs = process.argv.slice(4).join(" ");

// Validate inputs
const validEnvs = ["development", "staging", "production", "test"];
const validCommands = ["push", "generate", "up", "studio"];

if (!validEnvs.includes(env)) {
  console.error(`Error: Environment must be one of: ${validEnvs.join(", ")}`);
  process.exit(1);
}

if (!validCommands.includes(command)) {
  console.error(`Error: Command must be one of: ${validCommands.join(", ")}`);
  process.exit(1);
}

// Check if .env file exists for the specified environment
const envFile = env === "development" ? ".env" : `.env.${env}`;
const envPath = path.resolve(process.cwd(), envFile);

if (!fs.existsSync(envPath)) {
  console.error(`Error: Environment file ${envFile} not found at ${envPath}`);
  process.exit(1);
}

// Load environment variables from the specified .env file
console.log(`Loading environment variables from ${envFile}...`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error(`Error loading ${envFile}:`, result.error);
  process.exit(1);
}

// Log the environment we're using
console.log(`Using environment: ${env} (${envFile})`);
console.log(`DATABASE_URL: ${maskDatabaseUrl(process.env.DATABASE_URL || "")}`);
console.log(`Running command: ${command} ${additionalArgs}`);

// Create a temporary drizzle config that loads the correct .env file
const tempConfigPath = path.resolve(process.cwd(), "drizzle.config.temp.cjs");

const configContent = `
// CommonJS file
const dotenv = require('dotenv');
const path = require('node:path');
const { defineConfig } = require('drizzle-kit');

// Load environment-specific .env file
dotenv.config({ 
  path: path.resolve(process.cwd(), '${envFile}')
});

module.exports = defineConfig({
  schema: "./dist/schema.js",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:lyramusicai@localhost:5432/postgres",
  },
  verbose: true,
  strict: true,
});
`;

fs.writeFileSync(tempConfigPath, configContent);

try {
  // First compile TypeScript
  console.log("Compiling TypeScript...");
  execSync("tsc", { stdio: "inherit" });

  // Then run drizzle-kit with the temporary config and any additional arguments
  console.log(`Running drizzle-kit ${command} ${additionalArgs}...`);
  execSync(
    `NODE_ENV=${env} drizzle-kit ${command} --config=drizzle.config.temp.cjs ${additionalArgs}`,
    {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: env,
      },
    },
  );

  console.log(`\n✅ Successfully ran drizzle-kit ${command} with ${env} environment!`);
} catch (error) {
  console.error(`\n❌ Error running command:`, error.message);
  process.exit(1);
} finally {
  // Clean up temporary config
  fs.unlinkSync(tempConfigPath);
}

// Helper function to mask sensitive parts of the DATABASE_URL
function maskDatabaseUrl(url) {
  return url.replace(/(postgresql:\/\/)([^:]+):([^@]+)@/, (_, protocol, user) => {
    return `${protocol}${user}:****@`;
  });
}
