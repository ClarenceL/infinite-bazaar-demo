import { resolve } from "node:path";
import process from "node:process";
import dotenv from "dotenv";

// This is an app so we always override
const dotenvConfig: dotenv.DotenvConfigOptions = { override: true };

// Set NODE_ENV to development by default if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
  console.log("[CRON2] NODE_ENV not set, defaulting to 'development'");
}

const env = process.env.NODE_ENV;

if (env !== "development") {
  dotenvConfig.path = resolve(`.env.${env}`);
  console.log(`[CRON2] Loading environment for NODE_ENV: ${env} from ${dotenvConfig.path}`);
} else {
  console.log(`[CRON2] Loading environment for NODE_ENV: ${env} from .env`);
}

const result = dotenv.config(dotenvConfig);

if (result.error) {
  console.warn(`Warning: Could not load .env.${env}`);
  console.warn("Falling back to default .env file");

  // Try to load the default .env file as fallback
  const defaultEnvPath = resolve(".env");
  const defaultResult = dotenv.config({ path: defaultEnvPath, override: true });

  if (defaultResult.error) {
    console.warn(`Warning: Could not load default .env file at ${defaultEnvPath}`);
  }
}
