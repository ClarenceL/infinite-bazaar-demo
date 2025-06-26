#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BjjProvider,
  CredentialStatusResolverRegistry,
  CredentialStatusType,
  CredentialStorage,
  CredentialWallet,
  EthStateStorage,
  type IDataStorage,
  type Identity,
  type IdentityCreationOptions,
  IdentityStorage,
  IdentityWallet,
  InMemoryDataSource,
  InMemoryMerkleTreeStorage,
  InMemoryPrivateKeyStore,
  IssuerResolver,
  KMS,
  KmsKeyType,
  type Profile,
  RHSResolver,
  type W3CCredential,
  defaultEthConnectionConfig,
} from "@0xpolygonid/js-sdk";
import { config } from "dotenv";

// Get the directory name using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment and load appropriate .env file
const env = process.env.NODE_ENV || "development";
console.log(`Using environment: ${env}`);

// Load the appropriate .env file
const envFile = `.env${env !== "development" ? `.${env}` : ""}`;
const envPath = path.resolve(process.cwd(), envFile);
const result = config({ path: envPath });

if (result.error) {
  console.error(`Error loading ${envFile}:`, result.error);
  process.exit(1);
}

console.log(`Loaded environment from ${envFile}`);

// Ensure logs directory exists
const logsDir = path.join(__dirname, "..", "logs");
const identitiesDir = path.join(logsDir, "identities");
if (!fs.existsSync(identitiesDir)) {
  fs.mkdirSync(identitiesDir, { recursive: true });
  console.log(`📁 Created identities directory: ${identitiesDir}`);
}

console.log("🧪 Testing PolygonID SDK createIdentity method...");

// Helper function to save identity data to logs
function saveIdentityToLogs(testName: string, identity: any, seed?: Uint8Array) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `identity-${testName.toLowerCase().replace(/\s+/g, "-")}-${timestamp}.json`;
  const filepath = path.join(identitiesDir, filename);

  const logData = {
    testName,
    timestamp: new Date().toISOString(),
    identity: {
      did: identity.did.string(),
      credentialId: identity.credential.id,
      credentialType: identity.credential.type,
      credentialSubject: identity.credential.credentialSubject,
      credentialIssuer: identity.credential.issuer,
      credentialIssuanceDate: identity.credential.issuanceDate,
      credentialExpirationDate: identity.credential.expirationDate,
    },
    seed: seed
      ? {
          hex: Buffer.from(seed).toString("hex"),
          base64: Buffer.from(seed).toString("base64"),
          length: seed.length,
        }
      : null,
  };

  fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
  console.log(`💾 Identity data saved to: ${filename}`);

  return filepath;
}

// Network configuration for Amoy testnet
const NETWORK_CONFIG = {
  rpcUrl: "https://rpc-amoy.polygon.technology/",
  contractAddress: "0x1a4cC30f2aA0377b0c3bc9848766D90cb4404124", // Amoy testnet State contract
  chainId: 80002,
  networkId: "amoy",
};

function initDataStorage(): IDataStorage {
  const networkConfig = {
    ...defaultEthConnectionConfig,
    url: NETWORK_CONFIG.rpcUrl,
    contractAddress: NETWORK_CONFIG.contractAddress,
    chainId: NETWORK_CONFIG.chainId,
  };

  console.log("📡 Initializing data storage with network config:", {
    chainId: NETWORK_CONFIG.chainId,
    rpcUrl: NETWORK_CONFIG.rpcUrl,
    networkId: NETWORK_CONFIG.networkId,
  });

  return {
    credential: new CredentialStorage(new InMemoryDataSource<W3CCredential>()),
    identity: new IdentityStorage(
      new InMemoryDataSource<Identity>(),
      new InMemoryDataSource<Profile>(),
    ),
    mt: new InMemoryMerkleTreeStorage(40),
    states: new EthStateStorage(networkConfig),
  };
}

function initCredentialWallet(dataStorage: IDataStorage): CredentialWallet {
  const resolvers = new CredentialStatusResolverRegistry();
  resolvers.register(CredentialStatusType.SparseMerkleTreeProof, new IssuerResolver());
  resolvers.register(
    CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
    new RHSResolver(dataStorage.states),
  );

  return new CredentialWallet(dataStorage, resolvers);
}

function initIdentityWallet(
  dataStorage: IDataStorage,
  credentialWallet: CredentialWallet,
): IdentityWallet {
  const memoryKeyStore = new InMemoryPrivateKeyStore();
  const bjjProvider = new BjjProvider(KmsKeyType.BabyJubJub, memoryKeyStore);
  const kms = new KMS();
  kms.registerKeyProvider(KmsKeyType.BabyJubJub, bjjProvider);

  return new IdentityWallet(kms, dataStorage, credentialWallet);
}

async function testCreateIdentity() {
  try {
    console.log("🔧 Setting up PolygonID SDK components...");

    // Initialize components
    const dataStorage = initDataStorage();
    const credentialWallet = initCredentialWallet(dataStorage);
    const identityWallet = initIdentityWallet(dataStorage, credentialWallet);

    console.log("✅ SDK components initialized successfully");

    // Test 1: Identity creation with custom seed
    console.log("\n🧪 Test 1: Identity creation with custom seed");

    const customSeed = new Uint8Array(32);
    crypto.getRandomValues(customSeed);

    const seededOptions: IdentityCreationOptions = {
      method: "iden3",
      blockchain: "polygon",
      networkId: NETWORK_CONFIG.networkId,
      seed: customSeed,
      revocationOpts: {
        type: CredentialStatusType.SparseMerkleTreeProof,
        id: `urn:uuid:${crypto.randomUUID()}`,
      },
    };

    console.log("📋 Creating identity with custom seed...");

    const seededResult = await identityWallet.createIdentity(seededOptions);

    console.log("✅ Seeded identity created successfully:");
    console.log("  - DID:", seededResult.did.string());
    console.log("  - Credential ID:", seededResult.credential.id);

    // Save to logs
    saveIdentityToLogs("Custom Seed Identity Creation", seededResult, customSeed);

    // Test 2: Deterministic identity creation (same seed should produce same DID)
    // console.log("\n🧪 Test 2: Deterministic identity creation");

    // const deterministicSeed = new Uint8Array(32);
    // deterministicSeed.fill(42); // Fill with a known value

    // const deterministicOptions: IdentityCreationOptions = {
    //   method: "iden3",
    //   blockchain: "polygon",
    //   networkId: NETWORK_CONFIG.networkId,
    //   seed: deterministicSeed,
    //   revocationOpts: {
    //     type: CredentialStatusType.SparseMerkleTreeProof,
    //     id: `urn:uuid:${crypto.randomUUID()}`,
    //   },
    // };

    // console.log("📋 Creating first deterministic identity...");
    // const deterministicResult1 = await identityWallet.createIdentity(deterministicOptions);

    // console.log("📋 Creating second deterministic identity with same seed...");
    // // Temporarily test failure case - uncomment next line to test error handling
    // // deterministicSeed[0] = 99; // This would cause different DIDs
    // const deterministicResult2 = await identityWallet.createIdentity(deterministicOptions);

    // const did1 = deterministicResult1.did.string();
    // const did2 = deterministicResult2.did.string();

    // console.log("✅ Deterministic identity test results:");
    // console.log("  - First DID:", did1);
    // console.log("  - Second DID:", did2);
    // console.log("  - Are DIDs identical?", did1 === did2 ? "✅ YES" : "❌ NO");

    // // Critical check: DIDs must be identical for deterministic creation
    // if (did1 !== did2) {
    //   console.error("❌ CRITICAL ERROR: Deterministic identity creation failed!");
    //   console.error("Expected identical DIDs but got different ones:");
    //   console.error("  - First DID: ", did1);
    //   console.error("  - Second DID:", did2);
    //   console.error("This indicates a problem with deterministic seed handling.");
    //   process.exit(1);
    // }

    // // Save to logs
    // saveIdentityToLogs("Deterministic Identity Creation 1", deterministicResult1, deterministicSeed);
    // saveIdentityToLogs("Deterministic Identity Creation 2", deterministicResult2, deterministicSeed);

    // Test 3: Different revocation options
    // console.log("\n🧪 Test 3: Different revocation options");

    // const reverseProofOptions: IdentityCreationOptions = {
    //   method: "iden3",
    //   blockchain: "polygon",
    //   networkId: NETWORK_CONFIG.networkId,
    //   revocationOpts: {
    //     type: CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
    //     id: `urn:uuid:${crypto.randomUUID()}`,
    //     nonce: 1,
    //   },
    // };

    // console.log("📋 Creating identity with reverse sparse merkle tree proof...");

    // try {
    //   const reverseProofResult = await identityWallet.createIdentity(reverseProofOptions);
    //   console.log("✅ Reverse proof identity created successfully:");
    //   console.log("  - DID:", reverseProofResult.did.string());

    //   // Save to logs
    //   saveIdentityToLogs("Reverse Proof Identity Creation", reverseProofResult);
    // } catch (error) {
    //   console.log(
    //     "⚠️  Reverse proof creation failed (this might be expected):",
    //     error instanceof Error ? error.message : String(error),
    //   );
    // }

    console.log("\n🎉 All PolygonID SDK tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join("\n") : undefined,
    });
    process.exit(1);
  }
}

async function testAPIEndpoints() {
  try {
    console.log("\n🌐 Testing API endpoints against running process...");

    const baseUrl = "http://localhost:3105";
    const authKey = process.env.OPUS_NITRO_AUTH_KEY || "test-key-123";

    // Test 1: Health endpoint (no auth required)
    console.log("\n🧪 Test 1: Health endpoint");
    try {
      const healthResponse = await fetch(`${baseUrl}/health`);
      const healthData = await healthResponse.json();

      console.log("✅ Health endpoint response:", {
        status: healthResponse.status,
        data: healthData,
      });
    } catch (error) {
      console.log(
        "❌ Health endpoint failed:",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Test 2: MCP list tools (auth required)
    console.log("\n🧪 Test 2: MCP list tools endpoint");
    try {
      const toolsResponse = await fetch(`${baseUrl}/v1/mcp/list_tools`, {
        headers: {
          "X-Auth-Key": authKey,
        },
      });
      const toolsData = await toolsResponse.json();

      console.log("✅ MCP list tools response:", {
        status: toolsResponse.status,
        toolCount: toolsData.count || 0,
        tools: toolsData.tools?.map((t: any) => t.name) || [],
      });
    } catch (error) {
      console.log(
        "❌ MCP list tools failed:",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Test 3: Create name tool (should work)
    console.log("\n🧪 Test 3: Create name tool");
    try {
      const createNameResponse = await fetch(`${baseUrl}/v1/mcp/create_name`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Key": authKey,
        },
        body: JSON.stringify({
          name: "Test Agent API " + Date.now(),
          entity_id: "test-api-" + Date.now(),
        }),
      });
      const createNameData = await createNameResponse.json();

      console.log("✅ Create name response:", {
        status: createNameResponse.status,
        success: createNameData.success,
        error: createNameData.data?.error || null,
      });
    } catch (error) {
      console.log("❌ Create name failed:", error instanceof Error ? error.message : String(error));
    }

    // Test 4: Create identity tool (this is where the PolygonID SDK error might occur)
    console.log("\n🧪 Test 4: Create identity tool (PolygonID SDK test)");
    try {
      const testEntityId = "test-identity-api-" + Date.now();

      // First create a name for the entity
      const createNameResponse = await fetch(`${baseUrl}/v1/mcp/create_name`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Key": authKey,
        },
        body: JSON.stringify({
          name: "Test Identity Agent " + Date.now(),
          entity_id: testEntityId,
        }),
      });

      if (createNameResponse.ok) {
        console.log("📋 Name created successfully, now testing identity creation...");

        // Now try to create identity
        const createIdentityResponse = await fetch(`${baseUrl}/v1/mcp/create_identity`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Auth-Key": authKey,
          },
          body: JSON.stringify({
            entity_id: testEntityId,
          }),
        });

        const createIdentityData = await createIdentityResponse.json();

        console.log("✅ Create identity response:", {
          status: createIdentityResponse.status,
          success: createIdentityData.success,
          hasDID: !!createIdentityData.data?.identity?.did,
          error: createIdentityData.data?.error || null,
        });

        if (createIdentityData.data?.identity?.did) {
          console.log("🎉 DID created successfully:", createIdentityData.data.identity.did);

          // Save API identity creation to logs
          const apiLogData = {
            testName: "API Identity Creation",
            timestamp: new Date().toISOString(),
            entityId: testEntityId,
            response: createIdentityData,
          };

          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const filename = `api-identity-creation-${timestamp}.json`;
          const filepath = path.join(identitiesDir, filename);

          fs.writeFileSync(filepath, JSON.stringify(apiLogData, null, 2));
          console.log(`💾 API identity data saved to: ${filename}`);
        }
      } else {
        console.log("❌ Failed to create name first, skipping identity test");
      }
    } catch (error) {
      console.log(
        "❌ Create identity failed:",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Test 5: Invalid tool (error handling)
    console.log("\n🧪 Test 5: Invalid tool (error handling)");
    try {
      const invalidResponse = await fetch(`${baseUrl}/v1/mcp/invalid_tool`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Key": authKey,
        },
        body: JSON.stringify({ test: "data" }),
      });
      const invalidData = await invalidResponse.json();

      console.log("✅ Invalid tool response:", {
        status: invalidResponse.status,
        error: invalidData.error || null,
      });
    } catch (error) {
      console.log(
        "❌ Invalid tool test failed:",
        error instanceof Error ? error.message : String(error),
      );
    }

    console.log("\n🎉 All API endpoint tests completed!");
  } catch (error) {
    console.error("❌ API endpoint tests failed:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join("\n") : undefined,
    });
  }
}

// Run the tests
async function runAllTests() {
  console.log("🚀 Starting PolygonID SDK test...");
  await testCreateIdentity();

  console.log("\n" + "=".repeat(60));
  console.log("🚀 Starting API endpoint tests...");
  console.log("📝 Note: Make sure the service is running with 'pnpm dev' in another terminal");
  await testAPIEndpoints();
}

runAllTests().catch((error) => {
  console.error("❌ Unhandled error in test:", error);
  process.exit(1);
});
