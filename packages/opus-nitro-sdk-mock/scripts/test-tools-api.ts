#!/usr/bin/env bun

/**
 * Test script for the new Tools API endpoints
 *
 * This demonstrates how to call the MCP tools directly via HTTP
 * instead of going through the streaming LangChain flow.
 */

const BASE_URL = "http://localhost:3105";

async function testMCPAPI() {
  console.log("🧪 Testing MCP v1 API endpoints...\n");

  try {
    // 1. List available tools (root endpoint)
    console.log("1️⃣ Listing available tools (GET /v1/mcp/):");
    const listResponse = await fetch(`${BASE_URL}/v1/mcp/`);
    const listResult = await listResponse.json();
    console.log(JSON.stringify(listResult, null, 2));
    console.log("\n" + "=".repeat(50) + "\n");

    // 2. List available tools (list_tools endpoint)
    console.log("2️⃣ Listing available tools (GET /v1/mcp/list_tools):");
    const listToolsResponse = await fetch(`${BASE_URL}/v1/mcp/list_tools`);
    const listToolsResult = await listToolsResponse.json();
    console.log(JSON.stringify(listToolsResult, null, 2));
    console.log("\n" + "=".repeat(50) + "\n");

    // 3. Test create_name tool
    console.log("3️⃣ Testing create_name tool:");
    const createNameResponse = await fetch(`${BASE_URL}/v1/mcp/create_name`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Test Agent Alpha",
        entity_id: "test-entity-123",
      }),
    });
    const createNameResult = await createNameResponse.json();
    console.log(JSON.stringify(createNameResult, null, 2));
    console.log("\n" + "=".repeat(50) + "\n");

    // 4. Test create_identity tool (requires existing name)
    console.log("4️⃣ Testing create_identity tool:");
    const createIdentityResponse = await fetch(`${BASE_URL}/v1/mcp/create_identity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entity_id: "test-entity-123",
      }),
    });
    const createIdentityResult = await createIdentityResponse.json();
    console.log(JSON.stringify(createIdentityResult, null, 2));
    console.log("\n" + "=".repeat(50) + "\n");

    // 5. Test batch execution
    console.log("5️⃣ Testing batch tool execution:");
    const batchResponse = await fetch(`${BASE_URL}/v1/mcp/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tools: [
          {
            name: "create_name",
            input: {
              name: "Batch Test Agent",
              entity_id: "batch-test-456",
            },
          },
          {
            name: "create_identity",
            input: {
              entity_id: "batch-test-456",
            },
          },
        ],
      }),
    });
    const batchResult = await batchResponse.json();
    console.log(JSON.stringify(batchResult, null, 2));
    console.log("\n" + "=".repeat(50) + "\n");

    // 6. Test invalid tool
    console.log("6️⃣ Testing invalid tool (should fail gracefully):");
    const invalidResponse = await fetch(`${BASE_URL}/v1/mcp/invalid_tool`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        some: "data",
      }),
    });
    const invalidResult = await invalidResponse.json();
    console.log(JSON.stringify(invalidResult, null, 2));
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testMCPAPI();
