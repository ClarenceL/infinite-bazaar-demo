import { logger } from "@infinite-bazaar-demo/logs";
import { Hono } from "hono";
import { processToolCall } from "../../agents/tools/handlers/index.js";
import { errorHandler } from "../../pkg/middleware/error.js";

// Define tool metadata (DRY - Don't Repeat Yourself)
const getToolsMetadata = () => [
  {
    name: "create_name",
    description: "Create a name and CDP wallet for an agent",
    version: "1.0.0",
    category: "identity",
    method: "POST",
    endpoint: "/v1/mcp/create_name",
    parameters: {
      name: {
        type: "string",
        required: true,
        description: "The name for the agent",
      },
      entity_id: {
        type: "string",
        required: true,
        description: "The entity ID",
      },
    },
    returns: {
      success: "boolean",
      name: "string",
      cdpName: "string",
      walletAddress: "string",
      cdpAccount: "object",
    },
    example: {
      request: {
        name: "Agent Alpha",
        entity_id: "ent_123",
      },
      response: {
        success: true,
        name: "Agent Alpha",
        cdpName: "agent_alpha",
        walletAddress: "0x...",
        cdpAccount: { name: "agent_alpha", address: "0x..." },
      },
    },
  },

  {
    name: "transfer_usdc",
    description: "Transfer USDC using Coinbase CDP SDK",
    version: "1.0.0",
    category: "payments",
    method: "POST",
    endpoint: "/v1/mcp/transfer_usdc",
    parameters: {
      to: {
        type: "string",
        required: true,
        description: "Recipient address",
      },
      amount: {
        type: "number",
        required: true,
        description: "Amount to transfer (positive number)",
      },
      entity_id: {
        type: "string",
        required: true,
        description: "The entity ID",
      },
    },
    returns: {
      success: "boolean",
      transactionHash: "string",
      from: "string",
      to: "string",
      amount: "number",
      token: "string",
      network: "string",
    },
    example: {
      request: {
        to: "0x742d35Cc6634C0532925a3b8D4C9db96590a4C5f",
        amount: 10.5,
        entity_id: "ent_123",
      },
      response: {
        success: true,
        transactionHash: "0x...",
        from: "0x...",
        to: "0x742d35Cc6634C0532925a3b8D4C9db96590a4C5f",
        amount: 10.5,
        token: "usdc",
        network: "base-sepolia",
      },
    },
  },
];

// Create the tools router
export const toolsRoutes = new Hono()
  .use("*", errorHandler())

  // List tools endpoint (same as root)
  .get("/list_tools", (c) => {
    const tools = getToolsMetadata();

    return c.json({
      success: true,
      version: "v1",
      service: "mcp-tools",
      tools,
      count: tools.length,
      message: "Available MCP tools with detailed metadata",
      timestamp: new Date().toISOString(),
    });
  })

  // Execute a specific tool by name
  .post("/:toolName", async (c) => {
    try {
      const toolName = c.req.param("toolName");
      const body = await c.req.json().catch(() => ({}));

      logger.info(
        {
          toolName,
          body,
          hasBody: !!body,
          bodyKeys: Object.keys(body || {}),
        },
        "🔧 HTTP tool call received",
      );

      // Validate tool name
      const validTools = ["create_name", "create_identity", "transfer_usdc", "create_x402_service", "discover_services", "call_paid_service"];
      if (!validTools.includes(toolName)) {
        return c.json(
          {
            success: false,
            error: `Unknown tool: ${toolName}`,
            availableTools: validTools,
          },
          400,
        );
      }

      // Process the tool call
      const result = await processToolCall(toolName, body);

      logger.info(
        {
          toolName,
          success: result.data?.success,
          hasError: !!result.data?.error,
        },
        "🔧 HTTP tool call completed",
      );

      // Return the result in a clean HTTP format
      return c.json({
        success: result.data?.success || false,
        tool: toolName,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(error, "❌ Error processing HTTP tool call");

      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  })

  // Health check endpoint for MCP tools
  .get("/health", (c) => {
    const validTools = ["create_name", "create_identity", "transfer_usdc", "create_x402_service", "discover_services", "call_paid_service"];

    return c.json({
      status: "healthy",
      service: "tools",
      availableTools: validTools,
      timestamp: new Date().toISOString(),
    });
  })

  // Environment check endpoint
  .get("/env", (c) => {
    return c.json({
      nodeEnv: process.env.NODE_ENV || "development",
      service: "opus-nitro-sdk-mock",
      timestamp: new Date().toISOString(),
    });
  });
