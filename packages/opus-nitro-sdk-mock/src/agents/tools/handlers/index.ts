/**
 * MCP Tool handlers
 */
// import { mcpTools } from "..";
import type { ToolCallResult } from "../../../types/message.js";

// Import handlers from their new locations
import { handleClaim } from "./claim/index.js";
import { handleClaimCdp } from "./claim-cdp/index.js";

/**
 * Process a tool call and return the result
 */
export async function processToolCall(
  toolName: string,
  toolInput: Record<string, any> | string | null | undefined,
  projectId: string,
  userId?: string,
  authToken?: string,
): Promise<ToolCallResult> {
  console.log(
    `Processing tool call "${toolName}" for project ${projectId}, user ${userId || "unknown"}`,
  );

  // Ensure toolInput is always an object
  const normalizedInput: Record<string, any> =
    typeof toolInput === "object" && toolInput !== null ? toolInput : {};

  console.log(`Tool input: ${JSON.stringify(normalizedInput, null, 2)}`);

  // // Automatically inject projectId for tools that require it
  // const toolDef = mcpTools.find((tool) => tool.name === toolName);
  // if (toolDef?.input_schema.required?.includes("project_id") && !normalizedInput.project_id) {
  //   console.log(`Automatically injecting project_id: ${projectId} into tool input`);
  //   normalizedInput.project_id = projectId;

  //   // For backward compatibility, also set projectId
  //   normalizedInput.projectId = projectId;
  // }

  // Add userId to the input for tools that need it
  if (userId) {
    normalizedInput.userId = userId;
  }

  // Add auth token to input if available
  if (authToken) {
    normalizedInput.authToken = authToken;
  }

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
