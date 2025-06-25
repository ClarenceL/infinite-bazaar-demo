/**
 * MCP Tool handlers
 */
// import { mcpTools } from "..";
import type { ToolCallResult } from "../../../types/message.js";

import { handleCreateIdentity } from "./create-identity/index.js";
// import { handleClaim } from "./claim/index.js";
import { handleCreateName } from "./create-name/index.js";
import { handleTransferUsdc } from "./transfer-usdc/index.js";

/**
 * Process a tool call and return the result
 */
export async function processToolCall(
  toolName: string,
  toolInput: Record<string, any> | string | null | undefined,
  entityId?: string,
): Promise<ToolCallResult> {
  console.log(`Processing tool call "${toolName}" for entity: ${entityId || "unknown"}`);

  // Ensure toolInput is always an object
  const normalizedInput: Record<string, any> =
    typeof toolInput === "object" && toolInput !== null ? toolInput : {};

  // Add entity_id to the input if provided
  if (entityId) {
    normalizedInput.entity_id = entityId;
  }

  console.log(`Tool input: ${JSON.stringify(normalizedInput, null, 2)}`);

  switch (toolName) {
    case "create_name":
      return handleCreateName(normalizedInput);

    case "create_identity":
      return handleCreateIdentity(normalizedInput);

    case "transfer_usdc":
      return handleTransferUsdc(normalizedInput);

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
