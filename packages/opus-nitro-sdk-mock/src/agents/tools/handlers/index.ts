/**
 * MCP Tool handlers
 */
// import { mcpTools } from "..";
import type { ToolCallResult } from "../../../types/message.js";

import { handleClaimCdp } from "./claim-cdp/index.js";
// Import handlers from their new locations
import { handleClaim } from "./claim/index.js";

/**
 * Process a tool call and return the result
 */
export async function processToolCall(
  toolName: string,
  toolInput: Record<string, any> | string | null | undefined,
): Promise<ToolCallResult> {
  console.log(`Processing tool call "${toolName}"`);

  // Ensure toolInput is always an object
  const normalizedInput: Record<string, any> =
    typeof toolInput === "object" && toolInput !== null ? toolInput : {};

  console.log(`Tool input: ${JSON.stringify(normalizedInput, null, 2)}`);

  switch (toolName) {
    case "claim":
      return handleClaim();

    case "claim-cdp":
      return handleClaimCdp();

    default:
      console.warn(`Unknown tool called: ${toolName}`);
      return {
        data: { inputProvided: normalizedInput, error: `Unknown tool: ${toolName}` },
      };
  }
}
