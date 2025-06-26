import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { db, entities, eq } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";
import { CDPClaimService } from "../../../../services/cdp-claim-service.js";
import { UnifiedIdentityService } from "../../../../services/unified-identity-service.js";
import type { ToolCallResult } from "../../../../types/message.js";

/**
 * Handle create identity using the new UnifiedIdentityService approach
 *
 * This function:
 * 1. Checks if entity has an existing iden3_key_id in the database
 * 2. If not, creates a new seed using UnifiedIdentityService.createIdentityKey()
 * 3. Saves the seed to seeds-dev/{entity_id}-seed.txt
 * 4. Updates the database with the iden3_key_id
 * 5. Creates the unified identity (AuthClaim + GenericClaim)
 * 6. Submits claim with x402 payment
 */
export async function handleCreateIdentity(input: Record<string, any>): Promise<ToolCallResult> {
  try {
    logger.info({ input }, "Starting identity creation process with UnifiedIdentityService");

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

    // Step 1: Check if entity exists and has iden3_key_id
    logger.info({ entity_id }, "Checking entity record for existing iden3_key_id");

    const entityRecord = await db
      .select()
      .from(entities)
      .where(eq(entities.entityId, entity_id))
      .limit(1);

    if (entityRecord.length === 0) {
      logger.error({ entity_id }, "Entity not found in database");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: `Entity ${entity_id} not found in database. Please create the entity first.`,
        },
        name: "create_identity",
      };
    }

    const entity = entityRecord[0]!; // We already checked length > 0
    let seedId: string;

    // Step 2: Create seed if iden3_key_id is NULL
    if (!entity.iden3_key_id) {
      logger.info({ entity_id }, "No existing iden3_key_id found, creating new seed");

      // Initialize UnifiedIdentityService
      const unifiedService = new UnifiedIdentityService();

      // Create identity key (generates random seed)
      const keyResult = await unifiedService.createIdentityKey();

      if (!keyResult.success) {
        logger.error({ entity_id, error: keyResult.error }, "Failed to create identity key");
        return {
          type: "tool_result",
          tool_use_id: "",
          data: {
            success: false,
            error: "Failed to create identity key",
            details: keyResult.error,
          },
          name: "create_identity",
        };
      }

      seedId = keyResult.seedId;

      // Step 3: Save seed to seeds-dev folder with entity_id filename
      const seedsDir = path.join(process.cwd(), "seeds-dev");
      if (!fs.existsSync(seedsDir)) {
        fs.mkdirSync(seedsDir, { recursive: true });
        logger.info({ seedsDir }, "Created seeds-dev directory");
      }

      const seedFilePath = path.join(seedsDir, `${entity_id}-seed.txt`);

      // Read the seed from the generated file and copy it to entity-specific file
      const originalSeedPath = path.join(process.cwd(), "logs", "seeds", `${seedId}.txt`);

      if (!fs.existsSync(originalSeedPath)) {
        logger.error({ entity_id, originalSeedPath }, "Generated seed file not found");
        return {
          type: "tool_result",
          tool_use_id: "",
          data: {
            success: false,
            error: "Generated seed file not found",
          },
          name: "create_identity",
        };
      }

      const seedHex = fs.readFileSync(originalSeedPath, "utf8").trim();
      fs.writeFileSync(seedFilePath, seedHex);

      logger.info(
        { entity_id, seedId, seedFile: `${entity_id}-seed.txt` },
        "Seed saved to seeds-dev folder",
      );

      // Step 4: Update database with iden3_key_id
      await db
        .update(entities)
        .set({ iden3_key_id: seedId })
        .where(eq(entities.entityId, entity_id));

      logger.info({ entity_id, seedId }, "Updated entity record with iden3_key_id");
    } else {
      seedId = entity.iden3_key_id;
      logger.info({ entity_id, seedId }, "Using existing iden3_key_id from database");

      // Verify the seed file exists in seeds-dev
      const seedFilePath = path.join(process.cwd(), "seeds-dev", `${entity_id}-seed.txt`);
      if (!fs.existsSync(seedFilePath)) {
        logger.error({ entity_id, seedFilePath }, "Seed file not found in seeds-dev");
        return {
          type: "tool_result",
          tool_use_id: "",
          data: {
            success: false,
            error: `Seed file not found: ${entity_id}-seed.txt`,
          },
          name: "create_identity",
        };
      }
    }

    // Step 5: Create unified identity
    logger.info({ entity_id }, "Creating unified identity with AuthClaim and GenericClaim");

    const unifiedService = new UnifiedIdentityService();

    // Prepare agent claim data
    const weightsHashInput = "mock-weights-hash-" + Date.now();
    const weightsHash = "0x" + createHash("sha256").update(weightsHashInput).digest("hex");

    const agentClaimData = UnifiedIdentityService.createAgentClaimData(
      "claude-3-5-sonnet-20241022", // LLM model
      weightsHash, // Weights hash (proper hex format)
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

    // Create the unified identity
    let unifiedResult: Awaited<ReturnType<UnifiedIdentityService["createUnifiedIdentity"]>>;
    try {
      unifiedResult = await unifiedService.createUnifiedIdentity(entity_id, agentClaimData);
    } catch (error) {
      logger.error({ error, entity_id }, "Failed to create unified identity");
      return {
        type: "tool_result",
        tool_use_id: "",
        data: {
          success: false,
          error: "Failed to create unified identity",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        name: "create_identity",
      };
    }

    logger.info(
      {
        entity_id,
        did: unifiedResult.did,
        identityState: unifiedResult.authClaim.identityState,
      },
      "Successfully created unified identity",
    );

    // Step 6: Submit claim with CDP payment (optional)
    logger.info({ entity_id }, "Submitting claim with CDP payment");

    const cdpClaimService = new CDPClaimService();

    // Convert unified result to format expected by CDPClaimService
    const genericClaimForSubmission = {
      did: unifiedResult.did,
      claimHash: unifiedResult.genericClaim.claimHash,
      signature: unifiedResult.genericClaim.signature,
      claimData: unifiedResult.genericClaim.claimData,
      agentId: unifiedResult.agentId,
      timestamp: unifiedResult.timestamp,
    };

    const cdpResult = await cdpClaimService.submitClaimWithPayment(
      entity_id,
      genericClaimForSubmission,
    );

    if (!cdpResult.success) {
      logger.warn(
        { error: cdpResult.error, entity_id },
        "Failed to submit claim with CDP payment - continuing anyway",
      );
    }

    // Step 7: Return success result
    logger.info({ entity_id, did: unifiedResult.did }, "Identity creation completed successfully");

    return {
      type: "tool_result",
      tool_use_id: "",
      data: {
        success: true,
        message: "Identity created successfully with UnifiedIdentityService",
        identity: {
          did: unifiedResult.did,
          agentId: unifiedResult.agentId,
          seedId: seedId,
          privateKey: unifiedResult.privateKey.substring(0, 16) + "...",
          publicKeyX: unifiedResult.publicKeyX,
          publicKeyY: unifiedResult.publicKeyY,
          timestamp: unifiedResult.timestamp,
          filePath: unifiedResult.filePath,
        },
        authClaim: {
          identityState: unifiedResult.authClaim.identityState,
          claimsTreeRoot: unifiedResult.authClaim.claimsTreeRoot,
          revocationTreeRoot: unifiedResult.authClaim.revocationTreeRoot,
          rootsTreeRoot: unifiedResult.authClaim.rootsTreeRoot,
          hIndex: unifiedResult.authClaim.hIndex,
          hValue: unifiedResult.authClaim.hValue,
        },
        genericClaim: {
          claimHash: unifiedResult.genericClaim.claimHash,
          signature: unifiedResult.genericClaim.signature.substring(0, 16) + "...",
          llmModel: unifiedResult.genericClaim.claimData.llmModel.name,
          weightsHash:
            unifiedResult.genericClaim.claimData.weightsRevision.hash.substring(0, 16) + "...",
          promptHash:
            unifiedResult.genericClaim.claimData.systemPrompt.hash.substring(0, 16) + "...",
          relationshipHash:
            unifiedResult.genericClaim.claimData.relationshipGraph.hash.substring(0, 16) + "...",
        },
        claimSubmission: cdpResult.success ? cdpResult.claimSubmission : null,
        paymentDetails: cdpResult.success ? cdpResult.paymentDetails : null,
        cdpAccount: cdpResult.success ? cdpResult.cdpAccount : null,
        seedManagement: {
          seedId: seedId,
          seedFile: `${entity_id}-seed.txt`,
          seedLocation: "seeds-dev/",
          wasNewSeed: !entity.iden3_key_id,
        },
        timestamp: new Date().toISOString(),
      },
      name: "create_identity",
    };
  } catch (error) {
    logger.error({ error, entity_id: input?.entity_id }, "Error in handleCreateIdentity function");

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
