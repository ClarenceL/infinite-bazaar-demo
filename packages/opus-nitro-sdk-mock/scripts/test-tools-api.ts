#!/usr/bin/env bun

/**
 * Test script for the new Tools API endpoints
 *
 * This demonstrates how to call the MCP tools directly via HTTP
 * instead of going through the streaming LangChain flow.
 */

const BASE_URL = "http://localhost:3105";
const AUTH_KEY = process.env.OPUS_NITRO_AUTH_KEY || "test-key-123";

async function testMCPAPI() {
  console.log("🧪 Testing MCP v1 API endpoints...\n");
  console.log(`🔑 Using auth key: ${AUTH_KEY.substring(0, 8)}...\n`);

  try {
    // 1. List available tools (list_tools endpoint)
    console.log("1️⃣ Listing available tools (GET /v1/mcp/list_tools):");
    const listToolsResponse = await fetch(`${BASE_URL}/v1/mcp/list_tools`, {
      headers: {
        "X-Auth-Key": AUTH_KEY,
      },
    });
    const listToolsResult = await listToolsResponse.json();
    console.log(JSON.stringify(listToolsResult, null, 2));
    console.log("\n" + "=".repeat(50) + "\n");

    // 2. Test create_name tool
    console.log("2️⃣ Testing create_name tool:");
    const createNameResponse = await fetch(`${BASE_URL}/v1/mcp/create_name`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Key": AUTH_KEY,
      },
      body: JSON.stringify({
        name: "Test Agent Alpha",
        entity_id: "test-entity-123",
      }),
    });
    const createNameResult = await createNameResponse.json();
    console.log(JSON.stringify(createNameResult, null, 2));
    console.log("\n" + "=".repeat(50) + "\n");

    // 3. Test create_identity tool (requires existing name)
    console.log("3️⃣ Testing create_identity tool:");
    const createIdentityResponse = await fetch(`${BASE_URL}/v1/mcp/create_identity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Key": AUTH_KEY,
      },
      body: JSON.stringify({
        entity_id: "test-entity-123",
      }),
    });
    const createIdentityResult = await createIdentityResponse.json();
    console.log(JSON.stringify(createIdentityResult, null, 2));
    console.log("\n" + "=".repeat(50) + "\n");

    // 4. Test invalid tool
    console.log("4️⃣ Testing invalid tool (should fail gracefully):");
    const invalidResponse = await fetch(`${BASE_URL}/v1/mcp/invalid_tool`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Key": AUTH_KEY,
      },
      body: JSON.stringify({
        some: "data",
      }),
    });
    const invalidResult = await invalidResponse.json();
    console.log(JSON.stringify(invalidResult, null, 2));
    console.log("\n" + "=".repeat(50) + "\n");

    // 5. Test health endpoint
    console.log("5️⃣ Testing health endpoint (GET /v1/mcp/health):");
    const healthResponse = await fetch(`${BASE_URL}/v1/mcp/health`, {
      headers: {
        "X-Auth-Key": AUTH_KEY,
      },
    });
    const healthResult = await healthResponse.json();
    console.log(JSON.stringify(healthResult, null, 2));
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testMCPAPI();
