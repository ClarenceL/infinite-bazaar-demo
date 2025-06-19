/**
 * MCP Tool handlers
 */
// import { mcpTools } from "..";
import type { ToolCallResult } from "../../../types/message.js";

import { handleClaimCdp } from "./claim-cdp/index.js";
// Import handlers from their new locations
import { handleClaim } from "./claim/index.js";
import { handleCreateIdentity } from "./create-identity/index.js";

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
    case "create_identity":
      return handleCreateIdentity(normalizedInput);

    case "claim":
      return handleClaim();

    case "claim-cdp":
      return handleClaimCdp();

    default:
      console.warn(`Unknown tool called: ${toolName}`);
      return {
        type: "tool_result",
        tool_use_id: "",
        data: { inputProvided: normalizedInput, error: `Unknown tool: ${toolName}` },
        name: toolName,
      };
  }
}
