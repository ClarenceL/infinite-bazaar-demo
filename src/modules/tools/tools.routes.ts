import { logger } from "@infinite-bazaar-demo/logs";
import { Hono } from "hono";
import { errorHandler } from "../../pkg/middleware/error.js";
import { processToolCall } from "../../agents/tools/handlers/index.js";

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
        description: "The name for the agent"
      },
      entity_id: {
        type: "string",
        required: true,
        description: "The entity ID"
      }
    },
    returns: {
      success: "boolean",
      name: "string",
      cdpName: "string",
      walletAddress: "string",
      cdpAccount: "object"
    },
    example: {
      request: {
        name: "Agent Alpha",
        entity_id: "ent_123"
      },
      response: {
        success: true,
        name: "Agent Alpha",
        cdpName: "agent_alpha",
        walletAddress: "0x...",
        cdpAccount: { name: "agent_alpha", address: "0x..." }
      }
    }
  },
  {
    name: "create_identity",
    description: "Create identity with x402 payment using existing CDP account",
    version: "1.0.0",
    category: "identity",
    method: "POST",
    endpoint: "/v1/mcp/create_identity",
    parameters: {
      entity_id: {
        type: "string",
        required: true,
        description: "The entity ID (must have existing name/CDP account)"
      }
    },
    returns: {
      success: "boolean",
      did: "string",
      claimData: "object",
      paymentHash: "string"
    },
    example: {
      request: {
        entity_id: "ent_123"
      },
      response: {
        success: true,
        did: "did:iden3:polygon:amoy:x3HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ2H2",
        claimData: { verified: true },
        paymentHash: "0x..."
      }
    }
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
        description: "Recipient address"
      },
      amount: {
        type: "number",
        required: true,
        description: "Amount to transfer (positive number)"
      },
      entity_id: {
        type: "string",
        required: true,
        description: "The entity ID"
      }
    },
    returns: {
      success: "boolean",
      transactionHash: "string",
      from: "string",
      to: "string",
      amount: "number",
      token: "string",
      network: "string"
    },
    example: {
      request: {
        to: "0x742d35Cc6634C0532925a3b8D4C9db96590a4C5f",
        amount: 10.5,
        entity_id: "ent_123"
      },
      response: {
        success: true,
        transactionHash: "0x...",
        from: "0x...",
        to: "0x742d35Cc6634C0532925a3b8D4C9db96590a4C5f",
        amount: 10.5,
        token: "usdc",
        network: "base-sepolia"
      }
    }
  }
];

// Create the tools router
export const toolsRoutes = new Hono()
  .use("*", errorHandler())

  // Batch execute multiple tools - MUST come before /:toolName to avoid conflicts
  .post("/batch", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { tools } = body;

      logger.info(
        {
          toolName: "batch",
          body,
          hasBody: !!body,
          bodyKeys: Object.keys(body || {})
        },
        "🔧 HTTP tool call received"
      );

      if (!Array.isArray(tools)) {
        return c.json({
          success: false,
          error: "Request body must contain 'tools' array"
        }, 400);
      }

      if (tools.length === 0) {
        return c.json({
          success: false,
          error: "Tools array cannot be empty"
        }, 400);
      }

      logger.info(
        {
          toolCount: tools.length,
          toolNames: tools.map((t: any) => t.name)
        },
        "🔧 HTTP batch tool calls received"
      );

      const results = [];

      for (const tool of tools) {
        if (!tool.name || typeof tool.name !== "string") {
          results.push({
            success: false,
            error: "Each tool must have a 'name' property",
            tool: tool
          });
          continue;
        }

        // Validate tool name
        const validTools = ["create_name", "create_identity", "transfer_usdc"];
        if (!validTools.includes(tool.name)) {
          results.push({
            success: false,
            error: `Unknown tool: ${tool.name}`,
            tool: tool.name,
            availableTools: validTools
          });
          continue;
        }

        try {
          const result = await processToolCall(tool.name, tool.input || {});
          results.push({
            success: result.data?.success || false,
            tool: tool.name,
            data: result.data
          });
        } catch (toolError) {
          logger.error(toolError, `❌ Error processing batch tool: ${tool.name}`);
          results.push({
            success: false,
            tool: tool.name,
            error: toolError instanceof Error ? toolError.message : "Unknown error"
          });
        }
      }

      const successCount = results.filter(r => r.success).length;

      logger.info(
        {
          totalTools: tools.length,
          successCount,
          failureCount: tools.length - successCount
        },
        "🔧 HTTP batch tool calls completed"
      );

      return c.json({
        success: successCount === tools.length,
        results,
        summary: {
          total: tools.length,
          successful: successCount,
          failed: tools.length - successCount
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(error, "❌ Error processing HTTP batch tool calls");

      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      }, 500);
    }
  })

  // List all available tools (root endpoint)
  .get("/", (c) => {
    const tools = getToolsMetadata();

    return c.json({
      success: true,
      version: "v1",
      service: "mcp-tools",
      tools,
      count: tools.length,
      message: "Available MCP tools with detailed metadata",
      timestamp: new Date().toISOString()
    });
  })

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
      timestamp: new Date().toISOString()
    });
  })

  // Health check endpoint
  .get("/health", (c) => {
    return c.json({
      success: true,
      service: "mcp-tools",
      version: "v1",
      status: "healthy",
      timestamp: new Date().toISOString()
    });
  })

  // Execute a specific tool by name - MUST come after specific routes to avoid conflicts
  .post("/:toolName", async (c) => {
    try {
      const toolName = c.req.param("toolName");
      const body = await c.req.json().catch(() => ({}));

      logger.info(
        {
          toolName,
          body,
          hasBody: !!body,
          bodyKeys: Object.keys(body || {})
        },
        "🔧 HTTP tool call received"
      );

      // Validate tool name
      const validTools = ["create_name", "create_identity", "transfer_usdc"];
      if (!validTools.includes(toolName)) {
        return c.json({
          success: false,
          error: `Unknown tool: ${toolName}`,
          availableTools: validTools
        }, 400);
      }

      // Process the tool call
      const result = await processToolCall(toolName, body);

      logger.info(
        {
          toolName,
          success: result.data?.success,
          hasError: !!result.data?.error
        },
        "🔧 HTTP tool call completed"
      );

      // Return the result in a clean HTTP format
      return c.json({
        success: result.data?.success || false,
        tool: toolName,
        data: result.data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(error, "❌ Error processing HTTP tool call");

      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      }, 500);
    }
  }); 