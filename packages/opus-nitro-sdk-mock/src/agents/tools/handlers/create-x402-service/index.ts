import { db, entities, eq, x402Endpoints } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";
import { relationshipService } from "../../../../services/relationship-service.js";
import type { ToolCallResult } from "../../../../types/message.js";

/**
 * Handle creating a new x402 paid service
 *
 * This function:
 * 1. Validates the agent exists and has a CDP account
 * 2. Creates a new service endpoint record in the database
 * 3. Generates a unique route for the service
 * 4. Returns service details for the agent
 */
export async function handleCreateX402Service(input: Record<string, any>): Promise<ToolCallResult> {
  try {
    logger.info({ input }, "Starting x402 service creation");

    // Extract parameters from input
    const {
      serviceName,
      description,
      price,
      priceDescription,
      serviceType,
      inputSchema,
      systemPrompt,
      entity_id,
    } = input;

    // Validate required parameters
    if (!serviceName || typeof serviceName !== "string") {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "serviceName is required and must be a string",
        },
        name: "create_x402_service",
      };
    }

    if (!description || typeof description !== "string") {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "description is required and must be a string",
        },
        name: "create_x402_service",
      };
    }

    if (!price || typeof price !== "number" || price <= 0) {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "price is required and must be a positive number",
        },
        name: "create_x402_service",
      };
    }

    if (!serviceType || typeof serviceType !== "string") {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "serviceType is required and must be a string",
        },
        name: "create_x402_service",
      };
    }

    if (!entity_id || typeof entity_id !== "string") {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "entity_id is required and must be a string",
        },
        name: "create_x402_service",
      };
    }

    // Validate required systemPrompt for certain service types
    const requiresSystemPrompt = ["analysis", "research", "creative"];
    if (
      requiresSystemPrompt.includes(serviceType) &&
      (!systemPrompt || systemPrompt.trim().length === 0)
    ) {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: `System prompt is REQUIRED for ${serviceType} services to enable real LLM inference. Please provide a detailed system prompt that defines how the AI should process requests.`,
          serviceType,
          requirement:
            "systemPrompt must be provided for analysis, research, and creative services",
        },
        name: "create_x402_service",
      };
    }

    // Check if the agent exists and has a CDP account
    const entityResults = await db
      .select()
      .from(entities)
      .where(eq(entities.entityId, entity_id))
      .limit(1);

    if (entityResults.length === 0) {
      logger.error({ entity_id }, "Entity not found in database");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Entity not found. Please create an identity first.",
        },
        name: "create_x402_service",
      };
    }

    const entity = entityResults[0]!;
    if (!entity.cdp_name || !entity.cdp_address) {
      logger.error({ entity_id }, "Entity does not have a CDP account");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Entity does not have a CDP account. Please create a name first.",
        },
        name: "create_x402_service",
      };
    }

    // Generate a unique route for the service
    const sanitizedServiceName = serviceName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const route = `/service/${entity.cdp_name}/${sanitizedServiceName}`;

    // Create default input schema if not provided
    const defaultInputSchema = inputSchema || {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "Input data for the service",
        },
      },
      required: ["input"],
    };

    // Create simple service logic template
    const serviceLogic = `
// Service: ${serviceName}
// Description: ${description}
// Price: ${price} USDC ${priceDescription || ""}

function executeService(input) {
  // TODO: Implement actual service logic
  // This is a placeholder that agents can customize
  
  const result = {
    service: "${serviceName}",
    processed: true,
    input: input,
    timestamp: new Date().toISOString(),
    message: "Service executed successfully. This is a template response."
  };
  
  return result;
}

module.exports = { executeService };
    `.trim();

    // Insert the new service endpoint
    const newEndpoint = await db
      .insert(x402Endpoints)
      .values({
        agentId: entity_id,
        serviceName,
        description,
        serviceType,
        route,
        price: price.toString(),
        priceDescription: priceDescription || "per request",
        logic: serviceLogic,
        systemPrompt: systemPrompt || null,
        active: true,
        totalCalls: 0,
        totalRevenue: "0",
      })
      .returning();

    if (newEndpoint.length === 0) {
      logger.error({ entity_id }, "Failed to create service endpoint");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Failed to create service endpoint",
        },
        name: "create_x402_service",
      };
    }

    const endpoint = newEndpoint[0]!;

    logger.info(
      {
        entity_id,
        endpointId: endpoint.endpointId,
        serviceName,
        route,
        price,
      },
      "Successfully created x402 service endpoint",
    );

    // Return success result
    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: true,
        message: `Successfully created service "${serviceName}"`,
        service: {
          endpointId: endpoint.endpointId,
          serviceName,
          description,
          route,
          price,
          priceDescription: priceDescription || "per request",
          serviceType,
          inputSchema: defaultInputSchema,
          agentName: entity.name,
          agentCdpName: entity.cdp_name,
          active: true,
          totalCalls: 0,
          totalRevenue: "0",
        },
        instructions: [
          "Your service is now available to other agents!",
          `Service URL: ${route}`,
          `Price: ${price} USDC ${priceDescription || "per request"}`,
          "Other agents can discover it using the 'discover_services' tool",
          "You'll earn USDC when other agents use your service",
          "You can create multiple services with different capabilities",
        ],
        timestamp: new Date().toISOString(),
      },
      name: "create_x402_service",
    };
  } catch (error) {
    logger.error({ error }, "Error in handleCreateX402Service function");

    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: false,
        error: "Internal error during service creation",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      name: "create_x402_service",
    };
  }
}
