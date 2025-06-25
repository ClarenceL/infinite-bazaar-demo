import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../index.js";
import { cleanupTestDatabase, setupTestDatabase } from "./setup.js";

describe("MCP API Routes", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe("GET /v1/mcp/list_tools", () => {
    it("should return list of available tools", async () => {
      const res = await app.request("/v1/mcp/list_tools", {
        headers: { "X-Auth-Key": "test-key-123" },
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toMatchObject({
        success: true,
        version: "v1",
        service: "mcp-tools",
        count: 3,
      });

      expect(data.tools).toHaveLength(3);
      expect(data.tools[0]).toMatchObject({
        name: "create_name",
        description: expect.any(String),
        version: "1.0.0",
        category: "identity",
        method: "POST",
        endpoint: "/v1/mcp/create_name",
      });
    });
  });

  describe("POST /v1/mcp/:toolName", () => {
    it("should validate tool name", async () => {
      const res = await app.request("/v1/mcp/invalid_tool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Key": "test-key-123",
        },
        body: JSON.stringify({ some: "data" }),
      });

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toMatchObject({
        success: false,
        error: "Unknown tool: invalid_tool",
        availableTools: ["create_name", "create_identity", "transfer_usdc"],
      });
    });

    it("should handle create_name tool call", async () => {
      const res = await app.request("/v1/mcp/create_name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Key": "test-key-123",
        },
        body: JSON.stringify({
          name: "Test Agent",
          entity_id: "test-123",
        }),
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toMatchObject({
        tool: "create_name",
        timestamp: expect.any(String),
      });

      // Should have either success or failure data
      expect(data.data).toBeDefined();
      expect(typeof data.success).toBe("boolean");
    });

    it("should handle missing parameters", async () => {
      const res = await app.request("/v1/mcp/create_name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Key": "test-key-123",
        },
        body: JSON.stringify({}), // Missing required parameters
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.data?.error).toContain("required");
    });

    it("should handle malformed JSON", async () => {
      const res = await app.request("/v1/mcp/create_name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Key": "test-key-123",
        },
        body: "invalid json",
      });

      // Should still return 200 but with empty body (handled by catch)
      expect(res.status).toBe(200);
    });
  });

  describe("GET /v1/mcp/health", () => {
    it("should return health status", async () => {
      const res = await app.request("/v1/mcp/health", {
        headers: { "X-Auth-Key": "test-key-123" },
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toMatchObject({
        status: "healthy",
        service: "tools",
        availableTools: ["create_name", "create_identity", "transfer_usdc"],
        timestamp: expect.any(String),
      });
    });
  });

  describe("Authentication", () => {
    it("should reject requests without X-Auth-Key header", async () => {
      const res = await app.request("/v1/mcp/list_tools");
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.message).toBe("X-Auth-Key header is required");
    });

    it("should reject requests with invalid X-Auth-Key", async () => {
      const res = await app.request("/v1/mcp/list_tools", {
        headers: { "X-Auth-Key": "invalid-key" },
      });
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.message).toBe("Invalid authentication key");
    });
  });

  describe("Error handling", () => {
    it("should handle requests without content-type header", async () => {
      const res = await app.request("/v1/mcp/create_name", {
        method: "POST",
        headers: { "X-Auth-Key": "test-key-123" },
        body: JSON.stringify({ name: "Test", entity_id: "test" }),
        // No Content-Type header
      });

      // Should still work due to error handling
      expect(res.status).toBe(200);
    });

    it("should handle empty request body", async () => {
      const res = await app.request("/v1/mcp/create_name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Key": "test-key-123",
        },
        // No body
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      // Should fail due to missing required parameters
      expect(data.success).toBe(false);
    });
  });
});
