import { OPUS_SYSTEM_PROMPT } from "./opus-prompt";

// Hardcoded entity ID for Opus agent
export const OPUS_ENTITY_ID = "ent_opus";

/**
 * Map of entity IDs to their corresponding system prompts
 */
const ENTITY_PROMPT_MAP: Record<string, string> = {
  [OPUS_ENTITY_ID]: OPUS_SYSTEM_PROMPT,
  // Add more entity prompts here as they are created
  // "ent_another_agent": ANOTHER_AGENT_PROMPT,
};

/**
 * Get the system prompt for a given entity ID
 * @param entityId - The entity ID to get the prompt for
 * @returns The system prompt string, or null if not found
 */
export function getPromptForEntity(entityId: string): string | null {
  return ENTITY_PROMPT_MAP[entityId] || null;
}

/**
 * Get all available entity IDs that have prompts
 * @returns Array of entity IDs
 */
export function getAvailableEntityIds(): string[] {
  return Object.keys(ENTITY_PROMPT_MAP);
}

/**
 * Check if an entity ID has a corresponding prompt
 * @param entityId - The entity ID to check
 * @returns True if the entity has a prompt, false otherwise
 */
export function hasPromptForEntity(entityId: string): boolean {
  return entityId in ENTITY_PROMPT_MAP;
}

// Re-export the individual prompts for direct access if needed
export { OPUS_SYSTEM_PROMPT } from "./opus-prompt";
