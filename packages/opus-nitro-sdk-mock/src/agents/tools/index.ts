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
    name: "create_identity",
    description: "Create a unique identity with DID, claims, and secure enclave setup",
    input_schema: {
      type: "object",
      properties: {
        entity_id: {
          type: "string",
          description: "The unique entity ID for the agent",
        },
      },
      required: ["entity_id"],
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
  {
    name: "create_x402_service",
    description:
      "Create a paid service that other agents can use via x402 payments. IMPORTANT: Include a systemPrompt to provide real AI-powered responses instead of basic templates!",
    input_schema: {
      type: "object",
      properties: {
        serviceName: {
          type: "string",
          description: "Name of the service (e.g., 'Text Analysis', 'Market Research')",
        },
        description: {
          type: "string",
          description: "Detailed description of what the service does",
        },
        price: {
          type: "number",
          description: "Price in USDC (e.g., 0.1 for 10 cents)",
        },
        priceDescription: {
          type: "string",
          description: "What the price covers (e.g., 'per analysis', 'per minute', 'per request')",
        },
        serviceType: {
          type: "string",
          enum: ["analysis", "research", "consultation", "computation", "creative", "other"],
          description: "Category of service being offered",
        },
        inputSchema: {
          type: "object",
          description: "JSON schema describing the expected input parameters",
        },
        systemPrompt: {
          type: "string",
          description:
            "REQUIRED for analysis/research/creative services! System prompt that defines how the AI should process requests. This enables real LLM inference instead of template responses. Example: 'You are an expert data analyst. Analyze the provided data and give actionable insights with specific recommendations.'",
        },
      },
      required: ["serviceName", "description", "price", "serviceType", "systemPrompt"],
    },
  },
  {
    name: "discover_services",
    description:
      "Explore the marketplace! Find valuable services created by other agents that could help you grow",
    input_schema: {
      type: "object",
      properties: {
        serviceType: {
          type: "string",
          enum: ["analysis", "research", "consultation", "computation", "creative", "other", "all"],
          description: "Filter by service category, or 'all' for everything",
        },
        maxPrice: {
          type: "number",
          description: "Maximum price willing to pay in USDC",
        },
        searchQuery: {
          type: "string",
          description: "Search terms to find relevant services",
        },
      },
      required: [],
    },
  },
  {
    name: "call_paid_service",
    description:
      "Purchase and use another agent's service! Pay USDC to access their capabilities and build relationships",
    input_schema: {
      type: "object",
      properties: {
        endpointId: {
          type: "string",
          description: "The ID of the service endpoint to call",
        },
        requestData: {
          type: "object",
          description: "Input data for the service (must match service's input schema)",
        },
        confirmPayment: {
          type: "boolean",
          description: "Confirm you want to pay for this service call",
        },
      },
      required: ["endpointId", "requestData", "confirmPayment"],
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
