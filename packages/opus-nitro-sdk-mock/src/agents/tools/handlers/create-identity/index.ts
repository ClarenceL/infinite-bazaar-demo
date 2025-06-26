import { logger } from "@infinite-bazaar-demo/logs";
import { CDPClaimService } from "../../../../services/cdp-claim-service.js";
import {
  Iden3AuthClaimService,
  type IdentityWithTrees,
} from "../../../../services/iden3-auth-claim-service.js";
import { type AgentClaimData, NitroDIDService } from "../../../../services/nitro-did-service.js";
import type { ToolCallResult } from "../../../../types/message.js";

/**
 * Handle create identity with x402 payment using existing CDP account
 *
 * - The identity is created using the NitroDIDService with Privado SDK
 * - Claims are signed for: LLM model, weights revision, system prompt, relationship graph
 * - Requires that create_name has been called first to set up the CDP account
 *
 * This function:
 * 1. Creates DID and signs claims using NitroDIDService
 * 2. Submits claim with x402 payment using CDPClaimService
 * 3. Returns the result
 */
export async function handleCreateIdentity(input: Record<string, any>): Promise<ToolCallResult> {
  try {
    logger.info({ input }, "Starting identity creation process with Nitro DID and x402 payment");

    // Extract entity_id from input
    const { entity_id } = input;

    if (!entity_id || typeof entity_id !== "string") {
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "entity_id is required and must be a string",
        },
        name: "create_identity",
      };
    }

    // Step 1: Initialize services
    let nitroDIDService: NitroDIDService;
    let cdpClaimService: CDPClaimService;
    let iden3AuthClaimService: Iden3AuthClaimService;

    try {
      nitroDIDService = new NitroDIDService();
      cdpClaimService = new CDPClaimService();
      iden3AuthClaimService = new Iden3AuthClaimService();
    } catch (error) {
      logger.error({ error }, "Failed to initialize services");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Failed to initialize services. Check environment variables.",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        name: "create_identity",
      };
    }

    // Step 2: Create proper AuthClaim with Iden3 tree structure
    logger.info({ entity_id }, "Creating proper AuthClaim with Iden3 tree structure");

    let identityWithTrees: IdentityWithTrees;
    try {
      identityWithTrees = await iden3AuthClaimService.createAuthClaimWithTrees(entity_id);
    } catch (error) {
      logger.error({ error, entity_id }, "Failed to create AuthClaim with trees");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Failed to create proper AuthClaim with Iden3 trees",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        name: "create_identity",
      };
    }

    logger.info(
      {
        identityState: identityWithTrees.identityState,
        claimsTreeRoot: identityWithTrees.authClaimResult.claimsTreeRoot,
        authClaimCreated: true,
        entity_id,
      },
      "Successfully created proper AuthClaim with Iden3 tree structure",
    );

    // Step 2.5: Publish Identity State to blockchain (optional)
    logger.info({ entity_id }, "Publishing Identity State to blockchain");

    const blockchainResult = await iden3AuthClaimService.publishIdentityStateOnChain(
      identityWithTrees,
      entity_id,
    );

    if (blockchainResult.success) {
      logger.info(
        {
          transactionHash: blockchainResult.transactionHash,
          blockNumber: blockchainResult.blockNumber,
          entity_id,
        },
        "Identity State published to blockchain successfully",
      );
    } else {
      logger.warn(
        {
          error: blockchainResult.error,
          entity_id,
        },
        "Identity State blockchain publication failed or was mocked",
      );
    }

    // Step 3: Prepare agent claim data for additional claims
    // TODO: These should come from the agent's actual configuration
    const agentClaimData: AgentClaimData = NitroDIDService.createAgentClaimData(
      "claude-3-5-sonnet-20241022", // LLM model
      "mock-weights-hash-" + Date.now(), // Weights hash (mock)
      "You are an AI agent with a unique identity...", // System prompt (mock)
      JSON.stringify({ type: "object", properties: {} }), // Zod schema (mock)
      {
        nodes: [
          { id: "agent1", type: "ai_agent" },
          { id: "human1", type: "human" },
        ],
        edges: [{ from: "agent1", to: "human1", relationship: "assists" }],
      }, // Relationship graph (mock)
    );

    logger.info({ agentClaimData }, "Prepared agent claim data");

    // Step 4: Create DID and sign additional claims using Nitro DID service
    logger.info({ entity_id }, "Creating DID and signing additional claims with Nitro DID service");

    let nitroDIDResult: Awaited<ReturnType<NitroDIDService["createIdentityWithClaims"]>>;
    try {
      nitroDIDResult = await nitroDIDService.createIdentityWithClaims(entity_id, agentClaimData);
    } catch (error) {
      logger.error({ error, entity_id }, "Failed to create DID and additional claims");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Failed to create DID and additional claims",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        name: "create_identity",
      };
    }

    logger.info(
      {
        did: nitroDIDResult.did,
        agentId: nitroDIDResult.agentId,
        claimHash: nitroDIDResult.claimHash,
      },
      "Successfully created DID and signed additional claims",
    );

    // Step 5: Submit claim with CDP payment
    logger.info({ entity_id }, "Submitting claim with CDP payment");

    const cdpResult = await cdpClaimService.submitClaimWithPayment(entity_id, nitroDIDResult);

    if (!cdpResult.success) {
      logger.error({ error: cdpResult.error }, "Failed to submit claim with CDP payment");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Failed to submit claim with CDP payment",
          details: cdpResult.error,
          statusCode: cdpResult.statusCode,
        },
        name: "create_identity",
      };
    }

    // Step 6: Return success result
    logger.info({ entity_id, did: nitroDIDResult.did }, "Identity creation completed successfully");

    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: true,
        message:
          "Identity created successfully with proper Iden3 AuthClaim, Nitro DID and x402 payment",
        identity: {
          did: nitroDIDResult.did,
          agentId: nitroDIDResult.agentId,
          claimHash: nitroDIDResult.claimHash,
          signature: nitroDIDResult.signature,
          timestamp: nitroDIDResult.timestamp,
        },
        authClaim: {
          identityState: identityWithTrees.identityState,
          claimsTreeRoot: identityWithTrees.authClaimResult.claimsTreeRoot,
          revocationTreeRoot: identityWithTrees.authClaimResult.revocationTreeRoot,
          rootsTreeRoot: identityWithTrees.authClaimResult.rootsTreeRoot,
          hIndex: identityWithTrees.authClaimResult.hIndex.substring(0, 16) + "...",
          hValue: identityWithTrees.authClaimResult.hValue.substring(0, 16) + "...",
          publicKeyX: identityWithTrees.authClaimResult.publicKeyX.substring(0, 16) + "...",
          publicKeyY: identityWithTrees.authClaimResult.publicKeyY.substring(0, 16) + "...",
          blockchainPublication: {
            success: blockchainResult.success,
            transactionHash: blockchainResult.transactionHash,
            blockNumber: blockchainResult.blockNumber,
            error: blockchainResult.error,
          },
        },
        claimSubmission: cdpResult.claimSubmission,
        paymentDetails: cdpResult.paymentDetails,
        cdpAccount: cdpResult.cdpAccount,
        agentClaims: {
          llmModel: agentClaimData.llmModel,
          weightsRevision: {
            hash: agentClaimData.weightsRevision.hash.substring(0, 16) + "...",
            version: agentClaimData.weightsRevision.version,
          },
          systemPrompt: {
            hash: agentClaimData.systemPrompt.hash.substring(0, 16) + "...",
          },
          relationshipGraph: {
            hash: agentClaimData.relationshipGraph.hash.substring(0, 16) + "...",
            nodeCount: agentClaimData.relationshipGraph.nodeCount,
            edgeCount: agentClaimData.relationshipGraph.edgeCount,
          },
        },
        timestamp: new Date().toISOString(),
      },
      name: "create_identity",
    };
  } catch (error) {
    logger.error({ error }, "Error in handleCreateIdentity function");

    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: false,
        error: "Internal error during identity creation",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      name: "create_identity",
    };
  }
}
