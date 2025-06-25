export { CreateNameResult } from "./create-name-result";
export { CreateIdentityResult } from "./create-identity-result";
export { TransferUsdcResult } from "./transfer-usdc-result";
export { DefaultToolResult } from "./default-tool-result";

import { CreateIdentityResult } from "./create-identity-result";
import { CreateNameResult } from "./create-name-result";
import { DefaultToolResult } from "./default-tool-result";
import { TransferUsdcResult } from "./transfer-usdc-result";

export interface ToolResultProps {
  message: {
    id: string;
    toolName: string;
    content: string;
    toolResultData?: any;
    completedAt?: number | null;
  };
}

// Registry mapping tool names to their renderers
export const TOOL_RESULT_RENDERERS = {
  create_name: CreateNameResult,
  create_identity: CreateIdentityResult,
  transfer_usdc: TransferUsdcResult,
} as const;

// Get the appropriate renderer for a tool
export function getToolResultRenderer(toolName: string) {
  return TOOL_RESULT_RENDERERS[toolName as keyof typeof TOOL_RESULT_RENDERERS] || DefaultToolResult;
}
