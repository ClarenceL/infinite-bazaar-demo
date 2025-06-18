#!/usr/bin/env bun

import { logger } from "@infinite-bazaar-demo/logs";

const API_BASE_URL = process.env.OPUS_NITRO_SDK_MOCK_URL || "http://localhost:3105";

interface IdentityResponse {
  success: boolean;
  identity?: {
    did: string;
    keyId: string;
    filePath: string;
    timestamp: string;
  };
  credential?: any;
  mock: boolean;
  message?: string;
  error?: string;
}

async function createIdentity(): Promise<void> {
  try {
    logger.info("🔑 Creating new Privado ID identity...");

    const response = await fetch(`${API_BASE_URL}/enclave/identity/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: IdentityResponse = await response.json();

    if (data.success && data.identity) {
      logger.info(
        {
          did: data.identity.did,
          keyId: data.identity.keyId,
          filePath: data.identity.filePath,
          timestamp: data.identity.timestamp,
          mock: data.mock,
        },
        "✅ Identity created successfully!",
      );

      console.log("\n🎉 Identity Creation Results:");
      console.log("================================");
      console.log(`DID: ${data.identity.did}`);
      console.log(`Key ID: ${data.identity.keyId}`);
      console.log(`File Path: ${data.identity.filePath}`);
      console.log(`Created At: ${data.identity.timestamp}`);
      console.log(`Real Privado ID: ${!data.mock ? "Yes" : "No"}`);

      if (data.message) {
        console.log(`Message: ${data.message}`);
      }

      // Display credential info
      if (data.credential) {
        console.log("\n📋 Credential Information:");
        console.log("==========================");
        console.log(`Type: ${data.credential.type?.join(", ") || "Unknown"}`);
        console.log(`Issuer: ${data.credential.issuer || "Unknown"}`);
        console.log(`Subject: ${data.credential.credentialSubject?.id || "Unknown"}`);
      }
    } else {
      logger.error({ error: data.error }, "❌ Identity creation failed");
      console.error(`\n❌ Error: ${data.error || "Unknown error"}`);
      process.exit(1);
    }
  } catch (error) {
    logger.error({ error }, "❌ Failed to create identity");
    console.error(
      `\n❌ Failed to create identity: ${error instanceof Error ? error.message : "Unknown error"}`,
    );

    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      console.error("\n💡 Make sure the Opus Nitro SDK Mock server is running:");
      console.error("   pnpm dev");
      console.error(`   Server should be available at: ${API_BASE_URL}`);
    }

    process.exit(1);
  }
}

async function listIdentities(): Promise<void> {
  try {
    logger.info("📋 Fetching list of created identities...");

    const response = await fetch(`${API_BASE_URL}/enclave/identity/list`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success) {
      console.log(`\n📋 Found ${data.count} identities:`);
      console.log("================================");

      if (data.identities.length === 0) {
        console.log("No identities found. Create one first!");
      } else {
        data.identities.forEach((identity: any, index: number) => {
          console.log(`\n${index + 1}. DID: ${identity.did}`);
          console.log(`   Key ID: ${identity.keyId}`);
          console.log(`   Created: ${identity.createdAt}`);
          console.log(`   Blockchain: ${identity.blockchain}`);
          console.log(`   Network: ${identity.networkId}`);
          console.log(`   File: ${identity.filePath}`);
        });
      }
    } else {
      console.error(`\n❌ Error: ${data.error || "Unknown error"}`);
    }
  } catch (error) {
    logger.error({ error }, "❌ Failed to list identities");
    console.error(
      `\n❌ Failed to list identities: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];

  console.log("🔒 Opus Nitro SDK Mock - Identity Manager");
  console.log("==========================================");

  switch (command) {
    case "list":
      await listIdentities();
      break;
    default:
      await createIdentity();
      break;
  }
}

// Handle script execution
if (import.meta.main) {
  main().catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
}
