import { logger } from "@infinite-bazaar-demo/logs";
import { CDPClaimService } from "../../../../services/cdp-claim-service.js";
import { type AgentClaimData, NitroDIDService } from "../../../../services/nitro-did-service.js";
import type { ToolCallResult } from "../../../../types/message";

/**
 * Handle claim submission with x402 payment using CDP wallet
 * This function:
 * 1. Creates a test DID and claim using NitroDIDService
 * 2. Uses CDPClaimService to submit with x402 payment via CDP wallet
 * 3. Returns the result
 */
export async function handleClaim(): Promise<ToolCallResult> {
  try {
    logger.info("Starting claim submission process with CDP wallet x402 payment");

    // Step 1: Initialize services
    let nitroDIDService: NitroDIDService;
    let cdpClaimService: CDPClaimService;

    try {
      nitroDIDService = new NitroDIDService();
      cdpClaimService = new CDPClaimService();
    } catch (error) {
      logger.error({ error }, "Failed to initialize services");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Failed to initialize services. Check CDP environment variables.",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        name: "claim",
      };
    }

    // Step 2: Create a test entity ID for this claim test
    const testEntityId = "test-claim-entity-" + Date.now();
    logger.info({ testEntityId }, "Created test entity ID for claim test");

    // Step 3: Prepare agent claim data for the test
    const agentClaimData: AgentClaimData = NitroDIDService.createAgentClaimData(
      "claude-3-5-sonnet-20241022", // LLM model
      "test-claim-weights-hash-" + Date.now(), // Weights hash (test)
      "You are a test AI agent for claim submission...", // System prompt (test)
      JSON.stringify({ type: "object", properties: { test: { type: "string" } } }), // Zod schema (test)
      {
        nodes: [
          { id: "test-agent", type: "ai_agent" },
          { id: "test-human", type: "human" },
        ],
        edges: [{ from: "test-agent", to: "test-human", relationship: "test-assists" }],
      }, // Relationship graph (test)
    );

    logger.info({ agentClaimData }, "Prepared test agent claim data");

    // Step 4: Create DID and sign claims using Nitro DID service
    logger.info({ testEntityId }, "Creating test DID and signing claims with Nitro DID service");

    let nitroDIDResult: Awaited<ReturnType<NitroDIDService["createGenericClaim"]>>;
    try {
      nitroDIDResult = await nitroDIDService.createGenericClaim(testEntityId, agentClaimData);
    } catch (error) {
      logger.error({ error, testEntityId }, "Failed to create test DID and claims");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Failed to create test DID and claims",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        name: "claim",
      };
    }

    logger.info(
      {
        did: nitroDIDResult.did,
        agentId: nitroDIDResult.agentId,
        claimHash: nitroDIDResult.claimHash,
      },
      "Successfully created test DID and signed claims",
    );

    // Step 5: Submit claim with CDP payment
    // Note: This will fail because we don't have a CDP account for the test entity
    // But it will test the x402 payment flow and return a proper error
    logger.info(
      { testEntityId },
      "Attempting to submit claim with CDP payment (expected to fail gracefully)",
    );

    const cdpResult = await cdpClaimService.submitClaimWithPayment(testEntityId, nitroDIDResult);

    // Step 6: Return result (success or expected failure)
    if (cdpResult.success) {
      logger.info(
        { testEntityId, did: nitroDIDResult.did },
        "Claim submission completed successfully",
      );

      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: true,
          message: "Claim submitted successfully with CDP wallet x402 payment",
          claimSubmission: cdpResult.claimSubmission,
          paymentDetails: cdpResult.paymentDetails,
          accountAddress: cdpResult.cdpAccount?.address,
          timestamp: new Date().toISOString(),
        },
        name: "claim",
      };
    } else {
      // Expected failure - test entity doesn't have CDP account
      logger.info(
        { error: cdpResult.error },
        "Claim submission failed as expected (test entity has no CDP account)",
      );

      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Test claim submission failed (expected - no CDP account for test entity)",
          details: cdpResult.error,
          statusCode: cdpResult.statusCode,
          testNote:
            "This is expected behavior - the test creates a temporary entity without a CDP account",
          timestamp: new Date().toISOString(),
        },
        name: "claim",
      };
    }
  } catch (error) {
    logger.error({ error }, "Error in handleClaim function");

    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: false,
        error: "Internal error during claim submission",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      name: "claim",
    };
  }
}
