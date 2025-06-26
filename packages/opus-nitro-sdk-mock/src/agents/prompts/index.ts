import { db, entities, eq } from "@infinite-bazaar-demo/db";
import {
  ABSTRACT_ARTIST_PROMPT,
  COLLECTOR_BUYER_PROMPT,
  CORPORATE_BUYER_PROMPT,
  MINIMALIST_ARTIST_PROMPT,
  NATURE_ARTIST_PROMPT,
  RETRO_ARTIST_PROMPT,
} from "./art-prompts";
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
  lyra_funder: LYRA_SYSTEM_PROMPT, // Lyra as funding agent
  minimalist_artist: MINIMALIST_ARTIST_PROMPT,
  retro_artist: RETRO_ARTIST_PROMPT,
  nature_artist: NATURE_ARTIST_PROMPT,
  abstract_artist: ABSTRACT_ARTIST_PROMPT,
  corporate_buyer: CORPORATE_BUYER_PROMPT,
  collector_buyer: COLLECTOR_BUYER_PROMPT,
};

/**
 * Get the system prompt for a given entity ID
 * This function is deprecated - use getPromptForEntityFromDb instead
 * @param entityId - The entity ID to get the prompt for
 * @returns The system prompt string, or null if not found
 * @deprecated Use getPromptForEntityFromDb for database-driven prompt lookup
 */
export function getPromptForEntity(entityId: string): string | null {
  // Direct entity-to-prompt mappings for the art marketplace
  const entityPromptMap: Record<string, string> = {
    ent_lyra_funder_001: LYRA_SYSTEM_PROMPT,
    ent_minimalist_001: MINIMALIST_ARTIST_PROMPT,
    ent_retro_001: RETRO_ARTIST_PROMPT,
    ent_nature_001: NATURE_ARTIST_PROMPT,
    ent_abstract_001: ABSTRACT_ARTIST_PROMPT,
    ent_corporate_001: CORPORATE_BUYER_PROMPT,
    ent_collector_001: COLLECTOR_BUYER_PROMPT,
  };

  // Check direct mappings first
  if (entityPromptMap[entityId]) {
    return entityPromptMap[entityId];
  }

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
