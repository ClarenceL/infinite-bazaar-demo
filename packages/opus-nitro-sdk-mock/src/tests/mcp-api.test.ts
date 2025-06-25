import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../index.js";
import { setupTestDatabase, cleanupTestDatabase } from "./setup.js";

describe("MCP API Routes", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe("GET /v1/mcp/", () => {
    it("should return list of available tools", async () => {
      const res = await app.request("/v1/mcp/");

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toMatchObject({
        success: true,
        version: "v1",
        service: "mcp-tools",
        count: 3
      });

      expect(data.tools).toHaveLength(3);
      expect(data.tools[0]).toMatchObject({
        name: "create_name",
        description: expect.any(String),
        version: "1.0.0",
        category: "identity",
        method: "POST",
        endpoint: "/v1/mcp/create_name"
      });
    });
  });

  describe("GET /v1/mcp/list_tools", () => {
    it("should return the same data as root endpoint", async () => {
      const rootRes = await app.request("/v1/mcp/");
      const listRes = await app.request("/v1/mcp/list_tools");

      expect(rootRes.status).toBe(200);
      expect(listRes.status).toBe(200);

      const rootData = await rootRes.json();
      const listData = await listRes.json();

      // Both endpoints should return identical data
      expect(rootData).toEqual(listData);
    });
  });

  describe("POST /v1/mcp/:toolName", () => {
    it("should validate tool name", async () => {
      const res = await app.request("/v1/mcp/invalid_tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ some: "data" })
      });

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toMatchObject({
        success: false,
        error: "Unknown tool: invalid_tool",
        availableTools: ["create_name", "create_identity", "transfer_usdc"]
      });
    });

    it("should handle create_name tool call", async () => {
      const res = await app.request("/v1/mcp/create_name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Agent",
          entity_id: "test-123"
        })
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toMatchObject({
        tool: "create_name",
        timestamp: expect.any(String)
      });

      // Should have either success or failure data
      expect(data.data).toBeDefined();
      expect(typeof data.success).toBe("boolean");
    });

    it("should handle missing parameters", async () => {
      const res = await app.request("/v1/mcp/create_name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}) // Missing required parameters
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.data?.error).toContain("required");
    });

    it("should handle malformed JSON", async () => {
      const res = await app.request("/v1/mcp/create_name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json"
      });

      // Should still return 200 but with empty body (handled by catch)
      expect(res.status).toBe(200);
    });
  });

  describe("POST /v1/mcp/batch", () => {
    it("should validate batch request format", async () => {
      const res = await app.request("/v1/mcp/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalid: "format" })
      });

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toMatchObject({
        success: false,
        error: "Request body must contain 'tools' array"
      });
    });

    it("should handle empty tools array", async () => {
      const res = await app.request("/v1/mcp/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: [] })
      });

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toMatchObject({
        success: false,
        error: "Tools array cannot be empty"
      });
    });

    it("should handle batch tool execution", async () => {
      const res = await app.request("/v1/mcp/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tools: [
            {
              name: "create_name",
              input: {
                name: "Batch Agent 1",
                entity_id: "batch-1"
              }
            },
            {
              name: "invalid_tool",
              input: {}
            }
          ]
        })
      });

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toMatchObject({
        success: false,
        error: "Unknown tool: invalid_tool"
      });
    });

    it("should handle tools without name property", async () => {
      const res = await app.request("/v1/mcp/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tools: [
            { input: { some: "data" } } // Missing name property
          ]
        })
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.results).toHaveLength(1);
      expect(data.results[0]).toMatchObject({
        success: false,
        error: "Each tool must have a 'name' property"
      });
    });
  });

  describe("GET /v1/mcp/health", () => {
    it("should return health status", async () => {
      const res = await app.request("/v1/mcp/health");

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toMatchObject({
        status: "healthy",
        service: "tools",
        availableTools: ["create_name", "create_identity", "transfer_usdc"],
        timestamp: expect.any(String)
      });
    });
  });

  describe("Error handling", () => {
    it("should handle requests without content-type header", async () => {
      const res = await app.request("/v1/mcp/create_name", {
        method: "POST",
        body: JSON.stringify({ name: "Test", entity_id: "test" })
        // No Content-Type header
      });

      // Should still work due to error handling
      expect(res.status).toBe(200);
    });

    it("should handle empty request body", async () => {
      const res = await app.request("/v1/mcp/create_name", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
        // No body
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      // Should fail due to missing required parameters
      expect(data.success).toBe(false);
    });
  });
}); 