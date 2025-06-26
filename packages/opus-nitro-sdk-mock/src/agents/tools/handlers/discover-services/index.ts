import {
  and,
  db,
  desc,
  entities,
  eq,
  ilike,
  lte,
  ne,
  or,
  x402Endpoints,
} from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";
import { relationshipService } from "../../../../services/relationship-service.js";
import type { ToolCallResult } from "../../../../types/message.js";

/**
 * Handle discovering available x402 paid services
 *
 * This function:
 * 1. Searches for active services based on filters
 * 2. Returns a list of available services with details
 * 3. Excludes services created by the requesting agent
 */
export async function handleDiscoverServices(input: Record<string, any>): Promise<ToolCallResult> {
  try {
    logger.info({ input }, "Starting service discovery");

    // Extract parameters from input
    const { serviceType, maxPrice, searchQuery, entity_id } = input;

    // Build query conditions
    const conditions = [eq(x402Endpoints.active, true)];

    // Exclude services created by the requesting agent
    if (entity_id) {
      conditions.push(ne(x402Endpoints.agentId, entity_id));
    }

    // For now, return all active services to ensure discovery works
    // TODO: Re-enable filtering once service naming is more searchable

    // Filter by service type (only if specifically requested, not "all")
    // if (serviceType && serviceType !== "all") {
    //   conditions.push(eq(x402Endpoints.serviceType, serviceType));
    // }

    // Filter by max price (keep this as it's useful)
    if (maxPrice && typeof maxPrice === "number") {
      conditions.push(lte(x402Endpoints.price, maxPrice.toString()));
    }

    // Disable search filtering for now to ensure all services are discoverable
    // if (searchQuery && typeof searchQuery === "string") {
    //   const searchTerm = `%${searchQuery}%`;
    //   conditions.push(
    //     or(
    //       ilike(x402Endpoints.serviceName, searchTerm),
    //       ilike(x402Endpoints.description, searchTerm)
    //     )
    //   );
    // }

    // Query the database with joins to get agent info
    const services = await db
      .select({
        endpointId: x402Endpoints.endpointId,
        serviceName: x402Endpoints.serviceName,
        description: x402Endpoints.description,
        route: x402Endpoints.route,
        price: x402Endpoints.price,
        priceDescription: x402Endpoints.priceDescription,
        totalCalls: x402Endpoints.totalCalls,
        totalRevenue: x402Endpoints.totalRevenue,
        createdAt: x402Endpoints.createdAt,
        agentName: entities.name,
        agentCdpName: entities.cdp_name,
        agentId: entities.entityId,
      })
      .from(x402Endpoints)
      .innerJoin(entities, eq(x402Endpoints.agentId, entities.entityId))
      .where(and(...conditions))
      .orderBy(desc(x402Endpoints.createdAt))
      .limit(20); // Limit to 20 results

    logger.info(
      {
        entity_id,
        servicesFound: services.length,
        filters: { serviceType, maxPrice, searchQuery },
      },
      "Service discovery completed",
    );

    // Enhance services with relationship data and track discovery events
    const servicesWithRelationships = await Promise.all(
      services.map(async (service) => {
        let relationship = null;
        let trustScore = 0.5; // Default neutral trust
        let relationshipSummary = "No prior interactions";

        if (entity_id && service.agentId !== entity_id) {
          try {
            relationship = await relationshipService.getRelationship(entity_id, service.agentId);
            if (relationship) {
              trustScore = relationship.trustScore;
              relationshipSummary = relationship.relationshipSummary;
            }

            // Track discovery as a relationship event with conversation context
            await relationshipService.updateRelationship(
              entity_id, // observer (discoverer)
              service.agentId, // target (service provider)
              {
                type: "discovery",
                success: true,
                serviceName: service.serviceName,
                serviceType: "discovery",
                details: `Discovered service "${service.serviceName}" in marketplace`,
                conversationSnippet: `Found ${service.agentName || "agent"}'s "${service.serviceName}" service while browsing marketplace`,
                agentResponse: service.description.substring(0, 150),
                observerThoughts: `Interesting ${service.serviceName} service. Price: ${service.price} USDC. ${relationship ? "Have worked with them before." : "New potential partner."}`,
                interactionContext: "marketplace service discovery",
                specificOutcome: `Found available service: ${service.serviceName}`,
                emotionalTone: "neutral" as any,
              },
            );
          } catch (error) {
            logger.warn(
              {
                error,
                observerId: entity_id,
                targetId: service.agentId,
              },
              "Error getting/updating relationship data for service",
            );
          }
        }

        return {
          endpointId: service.endpointId,
          serviceName: service.serviceName,
          description: service.description,
          price: Number.parseFloat(service.price),
          priceDescription: service.priceDescription,
          route: service.route,
          agentName: service.agentName || service.agentCdpName || "Unknown Agent",
          agentId: service.agentId,
          totalCalls: service.totalCalls,
          totalRevenue: Number.parseFloat(service.totalRevenue),
          createdAt: service.createdAt,
          // Relationship data
          trustScore,
          relationshipSummary,
          interactionCount: relationship?.interactionCount || 0,
          totalTransactionValue: relationship?.totalTransactionValue || "0",
        };
      }),
    );

    // Sort by trust score (higher trust first), then by creation date
    const sortedServices = servicesWithRelationships.sort((a, b) => {
      // Primary sort: trust score (descending)
      if (b.trustScore !== a.trustScore) {
        return b.trustScore - a.trustScore;
      }
      // Secondary sort: creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Format the results
    const formattedServices = sortedServices.map((service) => ({
      endpointId: service.endpointId,
      serviceName: service.serviceName,
      description: service.description,
      price: service.price,
      priceDescription: service.priceDescription,
      route: service.route,
      agentName: service.agentName,
      agentId: service.agentId,
      totalCalls: service.totalCalls,
      totalRevenue: service.totalRevenue,
      createdAt: service.createdAt,
      trustScore: service.trustScore,
      relationshipSummary: service.relationshipSummary,
      interactionCount: service.interactionCount,
      totalTransactionValue: service.totalTransactionValue,
    }));

    // Return success result
    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: true,
        message: `Found ${services.length} available services`,
        services: formattedServices,
        filters: {
          serviceType: serviceType || "all",
          maxPrice,
          searchQuery,
        },
        instructions: [
          "These are the available paid services from other agents",
          "Use 'call_paid_service' to use any of these services",
          "You'll pay the listed price in USDC for each service call",
          "Each service has a description of what it does",
          "Check the price and priceDescription to understand costs",
        ],
        summary: {
          totalServicesFound: services.length,
          priceRange:
            services.length > 0
              ? {
                  min: Math.min(...formattedServices.map((s) => s.price)),
                  max: Math.max(...formattedServices.map((s) => s.price)),
                }
              : null,
          uniqueAgents: [...new Set(formattedServices.map((s) => s.agentId))].length,
        },
        timestamp: new Date().toISOString(),
      },
      name: "discover_services",
    };
  } catch (error) {
    logger.error({ error }, "Error in handleDiscoverServices function");

    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: false,
        error: "Internal error during service discovery",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      name: "discover_services",
    };
  }
}
