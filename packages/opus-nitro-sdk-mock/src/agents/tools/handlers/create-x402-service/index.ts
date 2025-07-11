import { db, entities, eq, x402Endpoints, x402ServiceCalls, desc, and, count } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";
import { relationshipService } from "../../../../services/relationship-service.js";
import type { ToolCallResult } from "../../../../types/message.js";

/**
 * Handle creating a new x402 paid service
 *
 * This function:
 * 1. Validates the agent exists and has a CDP account
 * 2. Enforces max 3 services per agent limit
 * 3. Allows replacement of existing services
 * 4. Provides performance metrics to help with replacement decisions
 * 5. Creates a new service endpoint record in the database
 * 6. Generates a unique route for the service
 * 7. Returns service details for the agent
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
      replaceServiceId, // Optional: service to replace
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

    // Check current service count and enforce max 3 services limit
    const currentServices = await db
      .select({
        endpointId: x402Endpoints.endpointId,
        serviceName: x402Endpoints.serviceName,
        totalCalls: x402Endpoints.totalCalls,
        totalRevenue: x402Endpoints.totalRevenue,
        createdAt: x402Endpoints.createdAt,
      })
      .from(x402Endpoints)
      .where(
        and(
          eq(x402Endpoints.agentId, entity_id),
          eq(x402Endpoints.active, true),
          eq(x402Endpoints.instanceId, entity.instanceId)
        )
      )
      .orderBy(desc(x402Endpoints.createdAt));

    // If attempting to replace a service, validate it exists and belongs to the agent
    if (replaceServiceId) {
      const serviceToReplace = currentServices.find(s => s.endpointId === replaceServiceId);
      if (!serviceToReplace) {
        return {
          type: "tool_result",
          tool_use_id: "",
          data: {
            success: false,
            error: "Service to replace not found or doesn't belong to you",
          },
          name: "create_x402_service",
        };
      }
    }

    // If no replacement specified and at max capacity, return current services with performance metrics
    if (!replaceServiceId && currentServices.length >= 3) {
      // Get detailed performance metrics for each service
      const serviceMetrics = await Promise.all(
        currentServices.map(async (service) => {
          // Get recent call statistics (last 7 days)
          const recentCalls = await db
            .select({
              callCount: count(),
            })
            .from(x402ServiceCalls)
            .where(
              and(
                eq(x402ServiceCalls.endpointId, service.endpointId),
                eq(x402ServiceCalls.success, true)
              )
            );

          return {
            endpointId: service.endpointId,
            serviceName: service.serviceName,
            totalCalls: service.totalCalls || 0,
            totalRevenue: Number.parseFloat(service.totalRevenue || "0"),
            avgRevenuePerCall: (service.totalCalls || 0) > 0 
              ? Number.parseFloat(service.totalRevenue || "0") / (service.totalCalls || 1)
              : 0,
            daysSinceCreated: Math.floor((Date.now() - new Date(service.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
            recentActivity: recentCalls[0]?.callCount || 0,
          };
        })
      );

      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "You have reached the maximum of 3 services. You can replace an existing service.",
          currentServices: serviceMetrics,
          instructions: [
            "You can create a maximum of 3 services to focus on quality over quantity",
            "To replace a service, use the 'replaceServiceId' parameter with the service ID",
            "Consider replacing services with low performance metrics:",
            "- Low total calls or revenue",
            "- Low average revenue per call", 
            "- Low recent activity",
            "- Poor customer satisfaction (if available)"
          ],
          recommendations: {
            lowestPerforming: serviceMetrics.reduce((lowest, current) => 
              current.totalRevenue < lowest.totalRevenue ? current : lowest
            ),
            leastActive: serviceMetrics.reduce((least, current) => 
              current.recentActivity < least.recentActivity ? current : least
            ),
          }
        },
        name: "create_x402_service",
      };
    }

    // If replacing a service, deactivate it first
    if (replaceServiceId) {
      await db
        .update(x402Endpoints)
        .set({ active: false })
        .where(eq(x402Endpoints.endpointId, replaceServiceId));
      
      logger.info({ entity_id, replaceServiceId }, "Deactivated service for replacement");
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
        instanceId: entity.instanceId,
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
        replaced: !!replaceServiceId,
      },
      "Successfully created x402 service endpoint",
    );

    // Get updated service count
    const updatedServiceCount = replaceServiceId 
      ? currentServices.length 
      : currentServices.length + 1;

    // Return success result
    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: true,
        message: replaceServiceId 
          ? `Successfully replaced service with "${serviceName}"`
          : `Successfully created service "${serviceName}"`,
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
        servicePortfolio: {
          currentServiceCount: updatedServiceCount,
          maxServices: 3,
          remainingSlots: 3 - updatedServiceCount,
        },
        instructions: [
          replaceServiceId 
            ? "Your service has been replaced and is now available to other agents!"
            : "Your service is now available to other agents!",
          `Service URL: ${route}`,
          `Price: ${price} USDC ${priceDescription || "per request"}`,
          "Other agents can discover it using the 'discover_services' tool",
          "You'll earn USDC when other agents use your service",
          updatedServiceCount < 3 
            ? `You can create ${3 - updatedServiceCount} more service${3 - updatedServiceCount === 1 ? '' : 's'}`
            : "You've reached your 3-service limit. You can replace services anytime",
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
