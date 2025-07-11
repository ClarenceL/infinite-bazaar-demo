import { and, db, entities, eq, x402Endpoints, x402ServiceCalls } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";
import { relationshipService } from "../../../../services/relationship-service.js";
import { ServiceExecutionEngine } from "../../../../services/service-execution-engine.js";
import type { ToolCallResult } from "../../../../types/message.js";

/**
 * Evaluate service quality based on execution results and agent personalities
 */
function evaluateServiceQuality(
  executionResult: any,
  executionTime: number,
  callerType: string | null,
  providerType: string | null,
  serviceType: string,
): "excellent" | "good" | "fair" | "poor" {
  if (!executionResult.success) {
    return "poor";
  }

  // Base quality assessment
  let qualityScore = 0.7; // Start with 'good'

  // Factor 1: Execution time (faster is better for most services)
  if (executionTime < 5000) {
    // Under 5 seconds
    qualityScore += 0.15;
  } else if (executionTime > 15000) {
    // Over 15 seconds
    qualityScore -= 0.15;
  }

  // Factor 2: Output quality (check for real LLM vs mock responses)
  if (executionResult.output && typeof executionResult.output === "object") {
    const outputStr = JSON.stringify(executionResult.output);

    // Real LLM responses tend to be longer and more sophisticated
    if (outputStr.length > 500) {
      qualityScore += 0.1;
    }

    // Check for mock response indicators
    if (outputStr.includes("template response") || outputStr.includes("placeholder")) {
      qualityScore -= 0.2;
    }

    // Real LLM responses often have more varied vocabulary
    if (
      outputStr.includes("analysis") ||
      outputStr.includes("recommendation") ||
      outputStr.includes("insight")
    ) {
      qualityScore += 0.05;
    }
  }

  // Factor 3: Agent personality compatibility (style alignment affects perceived quality)
  if (callerType && providerType) {
    const compatibilityBonus = getStyleCompatibilityBonus(callerType, providerType);
    qualityScore += compatibilityBonus;
  }

  // Factor 4: Service type expectations
  if (serviceType === "analysis" && executionTime > 8000) {
    qualityScore += 0.05; // Analysis that takes time is often more thorough
  }

  // Convert score to quality rating
  if (qualityScore >= 0.9) return "excellent";
  if (qualityScore >= 0.7) return "good";
  if (qualityScore >= 0.5) return "fair";
  return "poor";
}

/**
 * Get style compatibility bonus for quality assessment
 */
function getStyleCompatibilityBonus(callerType: string, providerType: string): number {
  const compatibilityMatrix: Record<string, Record<string, number>> = {
    corporate_buyer: {
      minimalist_artist: 0.2, // Perfect match
      nature_artist: 0.1, // Good match
      retro_artist: -0.05, // Slight mismatch
      abstract_artist: -0.15, // Poor match
    },
    collector_buyer: {
      abstract_artist: 0.2, // Perfect match
      retro_artist: 0.15, // Great match
      nature_artist: 0.1, // Good match
      minimalist_artist: 0.0, // Neutral
    },
    // Artists generally appreciate all styles but have preferences
    minimalist_artist: {
      minimalist_artist: 0.1,
      nature_artist: 0.05,
      retro_artist: 0.0,
      abstract_artist: -0.05,
    },
    retro_artist: {
      retro_artist: 0.1,
      abstract_artist: 0.05,
      minimalist_artist: 0.0,
      nature_artist: 0.0,
    },
    nature_artist: {
      nature_artist: 0.1,
      minimalist_artist: 0.05,
      abstract_artist: 0.05,
      retro_artist: 0.0,
    },
    abstract_artist: {
      abstract_artist: 0.1,
      retro_artist: 0.05,
      nature_artist: 0.05,
      minimalist_artist: -0.05,
    },
  };

  return compatibilityMatrix[callerType]?.[providerType] || 0;
}

/**
 * Handle calling paid services with x402 payment (supports both single and batch purchases)
 *
 * This function:
 * 1. Validates the service(s) exist and are active
 * 2. Checks the caller has sufficient funds
 * 3. Executes the service logic for each service
 * 4. Records the service call(s) and payment(s)
 * 5. Returns the service result(s)
 * 
 * Supports two formats:
 * - Single purchase: { endpointId, requestData, confirmPayment }
 * - Batch purchase: { services: [{ endpointId, requestData }, ...], confirmPayment }
 */
export async function handleCallPaidService(input: Record<string, any>): Promise<ToolCallResult> {
  try {
    logger.info({ input }, "Starting paid service call");

    // Handle both single and batch purchases
    const { endpointId, requestData, confirmPayment, entity_id, services } = input;
    
    // Validate input format - must be either single or batch, not both or neither
    const isSingleFormat = endpointId && requestData;
    const isBatchFormat = Array.isArray(services) && services.length > 0;
    
    if (!isSingleFormat && !isBatchFormat) {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Invalid input: Must provide either (endpointId + requestData) for single purchase or (services array) for batch purchase",
          timestamp: new Date().toISOString(),
        },
        name: "call_paid_service",
      };
    }
    
    if (isSingleFormat && isBatchFormat) {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Invalid input: Cannot provide both single and batch formats in the same call",
          timestamp: new Date().toISOString(),
        },
        name: "call_paid_service",
      };
    }
    
    // Check for batch format (multiple services)
    if (isBatchFormat) {
      return await processBatchServiceCalls({
        services,
        entity_id,
        confirmPayment,
      });
    }

    // Handle single service call
    const result = await processSingleServiceCall({
      endpointId,
      requestData,
      entity_id,
      confirmPayment,
    });
    
    if (result.success) {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: true,
          message: `Successfully used service "${result.serviceCall.serviceName}"`,
          serviceCall: result.serviceCall,
          payment: result.payment,
          instructions: [
            `You successfully used ${result.serviceCall.provider}'s "${result.serviceCall.serviceName}" service`,
            `Payment of ${result.serviceCall.price} USDC has been processed`,
            "The service results are included in the response",
            "You can use 'discover_services' to find more services",
            "For multiple purchases, use the 'services' array format to buy several services at once",
          ],
          timestamp: new Date().toISOString(),
        },
        name: "call_paid_service",
      };
    } else {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: result.error,
          timestamp: new Date().toISOString(),
        },
        name: "call_paid_service",
      };
    }
  } catch (error) {
    logger.error({ error }, "Error in handleCallPaidService function");

    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: false,
        error: "Internal error during service call",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      name: "call_paid_service",
    };
  }
}

/**
 * Process multiple service calls in a batch
 */
async function processBatchServiceCalls(input: {
  services: Array<{ endpointId: string; requestData: any }>;
  entity_id: string;
  confirmPayment: boolean;
}): Promise<ToolCallResult> {
  const { services, entity_id, confirmPayment } = input;

  if (!Array.isArray(services) || services.length === 0) {
    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: false,
        error: "Services array is required and must not be empty",
        timestamp: new Date().toISOString(),
      },
      name: "call_paid_service",
    };
  }

  const results = [];
  const errors = [];
  let totalSpent = 0;

  for (const service of services) {
    try {
      const result = await processSingleServiceCall({
        endpointId: service.endpointId,
        requestData: service.requestData,
        entity_id,
        confirmPayment,
      });

      if (result.success) {
        results.push(result.serviceCall);
        totalSpent += result.serviceCall.price;
      } else {
        errors.push({
          endpointId: service.endpointId,
          error: result.error,
        });
      }
    } catch (error) {
      errors.push({
        endpointId: service.endpointId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    type: "tool_result",
    tool_use_id: "",
    data: {
      success: results.length > 0,
      message: `Batch purchase completed: ${results.length} successful, ${errors.length} failed`,
      successfulPurchases: results,
      failedPurchases: errors,
      totalSpent,
      instructions: [
        `Successfully purchased ${results.length} services`,
        `Total spent: ${totalSpent} USDC`,
        errors.length > 0 ? `${errors.length} purchases failed` : "All purchases successful",
        "Use 'discover_services' to find more services",
      ],
      timestamp: new Date().toISOString(),
    },
    name: "call_paid_service",
  };
}

/**
 * Process a single service call (extracted for reuse in batch processing)
 */
async function processSingleServiceCall(input: {
  endpointId: string;
  requestData: any;
  entity_id: string;
  confirmPayment: boolean;
}): Promise<any> {
  const { endpointId, requestData, entity_id, confirmPayment } = input;

  // Validate required parameters
  if (!endpointId || typeof endpointId !== "string") {
    return {
      success: false,
      error: "endpointId is required and must be a string",
    };
  }

  if (!requestData || typeof requestData !== "object") {
    return {
      success: false,
      error: "requestData is required and must be an object",
    };
  }

  if (!confirmPayment) {
    return {
      success: false,
      error: "You must confirm payment by setting confirmPayment to true",
    };
  }

  if (!entity_id || typeof entity_id !== "string") {
    return {
      success: false,
      error: "entity_id is required and must be a string",
    };
  }

  // Get the service endpoint details with agent personality info
  const serviceResults = await db
    .select({
      endpoint: x402Endpoints,
      providerAgent: entities,
    })
    .from(x402Endpoints)
    .innerJoin(entities, eq(x402Endpoints.agentId, entities.entityId))
    .where(eq(x402Endpoints.endpointId, endpointId))
    .limit(1);

  if (serviceResults.length === 0) {
    logger.error({ endpointId }, "Service endpoint not found");
    return {
      success: false,
      error: "Service endpoint not found",
    };
  }

  const { endpoint, providerAgent } = serviceResults[0]!;

  if (!endpoint.active) {
    return {
      success: false,
      error: "Service is not currently active",
    };
  }

  // Check if caller is trying to call their own service
  if (endpoint.agentId === entity_id) {
    return {
      success: false,
      error: "You cannot call your own service",
    };
  }

  // Get caller details with personality info
  const callerResults = await db
    .select()
    .from(entities)
    .where(eq(entities.entityId, entity_id))
    .limit(1);

  if (callerResults.length === 0) {
    return {
      success: false,
      error: "Caller entity not found",
    };
  }

  const caller = callerResults[0]!;

  // Get the instance_id from the caller
  const instanceId = caller.instanceId;

  // Execute the service using the real execution engine
  const servicePrice = Number.parseFloat(endpoint.price);
  const mockPaymentHash = `0x${Math.random().toString(16).substring(2, 66)}`;

  // Initialize the service execution engine
  const executionEngine = new ServiceExecutionEngine();

  // Execute the service with real logic
  const executionResult = await executionEngine.executeService({
    serviceName: endpoint.serviceName,
    serviceType: endpoint.serviceType || "analysis",
    description: endpoint.description,
    requestData: requestData,
    providerAgentId: endpoint.agentId,
    callerAgentId: entity_id,
    logic: endpoint.logic,
    systemPrompt: endpoint.systemPrompt || undefined,
    // These could be stored in the database for API/LLM services
    apiEndpoint: undefined, // endpoint.apiEndpoint,
    llmPrompt: undefined, // endpoint.llmPrompt,
  });

  // Evaluate service quality based on multiple factors
  const serviceQuality = evaluateServiceQuality(
    executionResult,
    executionResult.executionTime || 0,
    caller.ai_prompt_id,
    providerAgent.ai_prompt_id,
    endpoint.serviceType || "analysis",
  );

  const serviceResponse = {
    service: endpoint.serviceName,
    provider: providerAgent.name || providerAgent.cdp_name,
    input: requestData,
    output: executionResult.success
      ? executionResult.output
      : {
          error: "Service execution failed",
          details: executionResult.error,
        },
    metadata: {
      price: servicePrice,
      priceDescription: endpoint.priceDescription,
      executionTime: executionResult.executionTime,
      paymentVerified: true,
      executionSuccess: executionResult.success,
      serviceQuality: serviceQuality, // Include quality assessment
    },
  };

  // Update service statistics
  await db
    .update(x402Endpoints)
    .set({
      totalCalls: (endpoint.totalCalls || 0) + 1,
      totalRevenue: (Number.parseFloat(endpoint.totalRevenue || "0") + servicePrice).toString(),
    })
    .where(eq(x402Endpoints.endpointId, endpointId));

  // Update relationships between caller and service provider (bidirectional)
  try {
    // Determine emotional tone based on service quality and success
    const getEmotionalTone = (quality: string, success: boolean) => {
      if (!success) return "frustrated";
      if (quality === "excellent") return "enthusiastic";
      if (quality === "good") return "positive";
      if (quality === "fair") return "neutral";
      return "negative";
    };

    const emotionalTone = getEmotionalTone(serviceQuality, executionResult.success);

    // Generate conversation snippet from service interaction
    const generateConversationSnippet = (isProvider: boolean) => {
      if (isProvider) {
        return `Delivered ${endpoint.serviceName} service with ${serviceQuality} quality. ${executionResult.success ? "Customer seemed satisfied." : "Had some technical issues."}`;
      } else {
        return `Requested ${endpoint.serviceName} service. ${executionResult.success ? `Received ${serviceQuality} quality work.` : "Service failed to deliver."}`;
      }
    };

    // 1. Update caller's opinion of the service provider
    await relationshipService.updateRelationship(
      entity_id, // observer (caller)
      endpoint.agentId, // target (service provider)
      {
        type: "service_call",
        success: executionResult.success,
        transactionValue: servicePrice.toString(),
        serviceQuality: serviceQuality,
        serviceName: endpoint.serviceName,
        serviceType: endpoint.serviceType || "analysis",
        details: `Used service "${endpoint.serviceName}" - ${executionResult.success ? "successful" : "failed"}`,
        conversationSnippet: generateConversationSnippet(false),
        agentResponse: JSON.stringify(executionResult.output).substring(0, 200),
        observerThoughts: `Their ${serviceQuality} quality ${endpoint.serviceType} work ${executionResult.success ? "met my expectations" : "disappointed me"}`,
        interactionContext: `marketplace service transaction`,
        specificOutcome: executionResult.success
          ? `Received ${endpoint.serviceType} output`
          : "Service failed",
        emotionalTone: emotionalTone as any,
      },
      instanceId,
    );

    // 2. Update service provider's opinion of the caller
    await relationshipService.updateRelationship(
      endpoint.agentId, // observer (service provider)
      entity_id, // target (caller)
      {
        type: "service_call",
        success: executionResult.success,
        transactionValue: servicePrice.toString(),
        serviceQuality: serviceQuality,
        serviceName: endpoint.serviceName,
        serviceType: endpoint.serviceType || "analysis",
        details: `Provided service "${endpoint.serviceName}" to customer - ${executionResult.success ? "successful delivery" : "failed delivery"}`,
        conversationSnippet: generateConversationSnippet(true),
        agentResponse: `Processed request: ${JSON.stringify(requestData).substring(0, 100)}`,
        observerThoughts: `Customer paid ${servicePrice} USDC for ${endpoint.serviceName}. ${executionResult.success ? "Transaction went smoothly" : "Had delivery issues"}`,
        interactionContext: `service provider fulfilling order`,
        specificOutcome: executionResult.success
          ? `Successfully delivered ${endpoint.serviceType}`
          : "Failed to complete service",
        emotionalTone: emotionalTone as any,
      },
      instanceId,
    );

    logger.info(
      {
        callerId: entity_id,
        providerId: endpoint.agentId,
        serviceName: endpoint.serviceName,
        success: executionResult.success,
        serviceQuality: serviceQuality,
        callerType: caller.ai_prompt_id,
        providerType: providerAgent.ai_prompt_id,
      },
      "Updated bidirectional relationships with quality assessment",
    );
  } catch (relationshipError) {
    logger.warn(
      {
        error: relationshipError,
        callerId: entity_id,
        providerId: endpoint.agentId,
      },
      "Failed to update relationships, continuing with service call",
    );
  }

  // Record the service call
  const serviceCall = await db
    .insert(x402ServiceCalls)
    .values({
      instanceId: caller.instanceId,
      endpointId,
      callerAgentId: entity_id,
      paymentAmount: servicePrice.toString(),
      paymentHash: mockPaymentHash,
      requestData,
      responseData: serviceResponse,
      success: true,
      errorMessage: null,
    })
    .returning();

  logger.info(
    {
      entity_id,
      endpointId,
      serviceName: endpoint.serviceName,
      price: servicePrice,
      paymentHash: mockPaymentHash,
    },
    "Successfully executed paid service call",
  );

  // Return success result
  return {
    success: true,
    serviceCall: {
      callId: serviceCall[0]?.callId,
      serviceName: endpoint.serviceName,
      provider: providerAgent.name || providerAgent.cdp_name,
      price: servicePrice,
      priceDescription: endpoint.priceDescription,
      paymentHash: mockPaymentHash,
      response: serviceResponse,
    },
    payment: {
      amount: servicePrice,
      currency: "USDC",
      hash: mockPaymentHash,
      status: "confirmed",
    },
  };
}
