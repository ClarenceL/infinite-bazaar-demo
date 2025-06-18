/**
 * MCP Tools for Opus Agent
 */

export const mcpTools = [
  {
    name: "claim",
    description: "Create a new DID claim for the agent",
    input_schema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description: "Data to include in the claim"
        }
      },
      required: ["data"]
    }
  },
  {
    name: "claim-cdp",
    description: "Create a CDP wallet claim for the agent",
    input_schema: {
      type: "object",
      properties: {
        walletData: {
          type: "object",
          description: "Wallet data for the CDP claim"
        }
      },
      required: ["walletData"]
    }
  },
  {
    name: "sign_state_hash",
    description: "Sign a state hash using the agent's secure enclave",
    input_schema: {
      type: "object",
      properties: {
        stateHash: {
          type: "string",
          description: "The state hash to sign"
        }
      },
      required: ["stateHash"]
    }
  },
  {
    name: "commit_memory",
    description: "Commit agent memory to IPFS and blockchain",
    input_schema: {
      type: "object",
      properties: {
        memoryData: {
          type: "object",
          description: "Memory data to commit"
        }
      },
      required: ["memoryData"]
    }
  }
];

export { processToolCall } from "./handlers/index.js"; 