import { db, entities, eq } from "@infinite-bazaar-demo/db";
import { LYRA_SYSTEM_PROMPT } from "./lyra-prompt";
import { OPUS_SYSTEM_PROMPT } from "./opus-prompt";

// Hardcoded entity ID for Opus agent
export const OPUS_ENTITY_ID = "ent_opus";

/**
 * Map of ai_prompt_id to their corresponding system prompts
 */
const AI_PROMPT_MAP: Record<string, string> = {
  opus: OPUS_SYSTEM_PROMPT,
  lyra: LYRA_SYSTEM_PROMPT,
  // Add more AI prompts here as they are created
  // "another_ai_prompt": ANOTHER_AI_PROMPT,
};

/**
 * Get the system prompt for a given entity ID
 * This function is deprecated - use getPromptForEntityFromDb instead
 * @param entityId - The entity ID to get the prompt for
 * @returns The system prompt string, or null if not found
 * @deprecated Use getPromptForEntityFromDb for database-driven prompt lookup
 */
export function getPromptForEntity(entityId: string): string | null {
  // Fallback for hardcoded entity mappings for backward compatibility
  if (entityId === OPUS_ENTITY_ID) {
    return OPUS_SYSTEM_PROMPT;
  }
  if (entityId === "god_lyra") {
    return LYRA_SYSTEM_PROMPT;
  }
  if (entityId === "ent_sonnet") {
    return OPUS_SYSTEM_PROMPT;
  }
  return null;
}

/**
 * Get all available entity IDs that have prompts
 * This function is deprecated - prompts are now stored in database
 * @returns Array of entity IDs
 * @deprecated Entity-prompt mapping is now database-driven
 */
export function getAvailableEntityIds(): string[] {
  return [OPUS_ENTITY_ID, "god_lyra", "ent_sonnet"]; // Fallback for backward compatibility
}

/**
 * Check if an entity ID has a corresponding prompt
 * This function is deprecated - use database lookup instead
 * @param entityId - The entity ID to check
 * @returns True if the entity has a prompt, false otherwise
 * @deprecated Use database lookup for entity prompt availability
 */
export function hasPromptForEntity(entityId: string): boolean {
  return entityId === OPUS_ENTITY_ID || entityId === "god_lyra" || entityId === "ent_sonnet"; // Fallback for backward compatibility
}

/**
 * Get all available AI prompt IDs
 * @returns Array of AI prompt IDs
 */
export function getAvailableAiPromptIds(): string[] {
  return Object.keys(AI_PROMPT_MAP);
}

/**
 * Get the system prompt for a given AI prompt ID
 * @param aiPromptId - The AI prompt ID to get the prompt for
 * @returns The system prompt string, or null if not found
 */
export function getPromptForAiPromptId(aiPromptId: string): string | null {
  return AI_PROMPT_MAP[aiPromptId] || null;
}

/**
 * Get the ai_prompt_id for an entity from the database
 * @param entityId - The entity ID to get the ai_prompt_id for
 * @returns The ai_prompt_id string, or null if not found
 */
export async function getAiPromptIdForEntity(entityId: string): Promise<string | null> {
  try {
    const result = await db
      .select({ aiPromptId: entities.ai_prompt_id })
      .from(entities)
      .where(eq(entities.entityId, entityId))
      .limit(1);

    return result[0]?.aiPromptId || null;
  } catch (error) {
    console.error(`Error fetching ai_prompt_id for entity ${entityId}:`, error);
    return null;
  }
}

/**
 * Get the anthropic model for an entity from the database
 * @param entityId - The entity ID to get the anthropic model for
 * @returns The anthropic model string, or null if not found
 */
export async function getAnthropicModelForEntity(entityId: string): Promise<string | null> {
  try {
    const result = await db
      .select({ anthropicModel: entities.anthropic_model })
      .from(entities)
      .where(eq(entities.entityId, entityId))
      .limit(1);

    return result[0]?.anthropicModel || null;
  } catch (error) {
    console.error(`Error fetching anthropic_model for entity ${entityId}:`, error);
    return null;
  }
}

/**
 * Get the system prompt for an entity by looking up their ai_prompt_id from the database
 * @param entityId - The entity ID to get the prompt for
 * @returns The system prompt string, or null if not found
 */
export async function getPromptForEntityFromDb(entityId: string): Promise<string | null> {
  try {
    const aiPromptId = await getAiPromptIdForEntity(entityId);
    if (!aiPromptId) {
      return null;
    }

    return getPromptForAiPromptId(aiPromptId);
  } catch (error) {
    console.error(`Error fetching prompt for entity ${entityId}:`, error);
    return null;
  }
}

// Re-export the individual prompts for direct access if needed
export { OPUS_SYSTEM_PROMPT } from "./opus-prompt";
export { LYRA_SYSTEM_PROMPT } from "./lyra-prompt";
