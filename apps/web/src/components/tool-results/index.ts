export { CreateNameResult } from "./create-name-result";
export { CreateIdentityResult } from "./create-identity-result";
export { TransferUsdcResult } from "./transfer-usdc-result";
export { CreateX402ServiceResult } from "./create-x402-service-result";
export { DiscoverServicesResult } from "./discover-services-result";
export { CallPaidServiceResult } from "./call-paid-service-result";
export { DefaultToolResult } from "./default-tool-result";

import { CallPaidServiceResult } from "./call-paid-service-result";
import { CreateIdentityResult } from "./create-identity-result";
import { CreateNameResult } from "./create-name-result";
import { CreateX402ServiceResult } from "./create-x402-service-result";
import { DefaultToolResult } from "./default-tool-result";
import { DiscoverServicesResult } from "./discover-services-result";
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
  create_x402_service: CreateX402ServiceResult,
  discover_services: DiscoverServicesResult,
  call_paid_service: CallPaidServiceResult,
} as const;

// Get the appropriate renderer for a tool
export function getToolResultRenderer(toolName: string) {
  return TOOL_RESULT_RENDERERS[toolName as keyof typeof TOOL_RESULT_RENDERERS] || DefaultToolResult;
}
