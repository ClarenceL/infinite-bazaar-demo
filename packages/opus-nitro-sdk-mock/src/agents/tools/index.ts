/**
 * MCP Tools for Opus Agent
 */

export const mcpTools = [
  {
    name: "create_name",
    description: "Create a name for yourself and set up wallet address",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "name",
        },
      },
      required: ["name"],
    },
  },

  {
    name: "transfer_usdc",
    description: "Transfer USDC tokens to another wallet address",
    input_schema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "The recipient wallet address",
        },
        amount: {
          type: "number",
          description: "The amount of USDC to transfer",
        },
      },
      required: ["to", "amount"],
    },
  },
  // {
  //   name: "claim-cdp",
  //   description: "Create a CDP wallet claim for the agent",
  //   input_schema: {
  //     type: "object",
  //     properties: {
  //       walletData: {
  //         type: "object",
  //         description: "Wallet data for the CDP claim",
  //       },
  //     },
  //     required: ["walletData"],
  //   },
  // },
  // {
  //   name: "sign_state_hash",
  //   description: "Sign a state hash using the agent's secure enclave",
  //   input_schema: {
  //     type: "object",
  //     properties: {
  //       stateHash: {
  //         type: "string",
  //         description: "The state hash to sign",
  //       },
  //     },
  //     required: ["stateHash"],
  //   },
  // },
  // {
  //   name: "commit_memory",
  //   description: "Commit agent memory to IPFS and blockchain",
  //   input_schema: {
  //     type: "object",
  //     properties: {
  //       memoryData: {
  //         type: "object",
  //         description: "Memory data to commit",
  //       },
  //     },
  //     required: ["memoryData"],
  //   },
  // },
];

export { processToolCall } from "./handlers/index.js";
