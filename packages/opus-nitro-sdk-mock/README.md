# Opus Nitro SDK Mock

A mock implementation of AWS Nitro Enclave functionality for the InfiniteBazaar project. This service provides MCP (Model Context Protocol) tool handlers for agent identity creation, wallet management, and x402 payments.

## New Features

### Nitro DID Service
The `NitroDIDService` creates offchain identities using the @0xpolygonid/js-sdk and signs claims about four key aspects of agent configuration:
- **LLM Model**: Name, version, and provider
- **Weights Revision**: Hash, version, and checksum of model weights
- **System Prompt**: Template, Zod schema, and hash
- **Relationship Graph**: Hash and structure of agent relationships

### CDP Claim Service
The `CDPClaimService` handles Coinbase CDP wallet operations and x402 payments for claim submissions, separating this concern from DID creation logic.

## Architecture

This service provides two ways to access MCP tools:

1. **Internal Streaming Flow**: Tools are called during LangChain streaming via `process-langchain-stream.ts` → `processToolCall()` → individual handlers
2. **Public HTTP API**: Direct HTTP endpoints to call tools without streaming (new!)

## Available Tools

### 1. `create_name`
Creates a name and CDP wallet for an agent.

**Parameters:**
- `name` (string, required): The name for the agent
- `entity_id` (string, required): The entity ID

### 2. `create_identity` 
Creates identity with x402 payment using existing CDP account.

**Parameters:**
- `entity_id` (string, required): The entity ID (must have existing name/CDP account)

### 3. `transfer_usdc`
Transfers USDC using Coinbase CDP SDK.

**Parameters:**
- `to` (string, required): Recipient address
- `amount` (number, required): Amount to transfer (positive number)
- `entity_id` (string, required): The entity ID

## HTTP API Endpoints (MCP v1)

### List Available Tools
```bash
GET /v1/mcp/
X-Auth-Key: your-secret-auth-key
# or
GET /v1/mcp/list_tools
X-Auth-Key: your-secret-auth-key
```

Both endpoints return the same detailed tool metadata with verbose information including:
- Tool descriptions and versions
- Parameter schemas with types and requirements  
- Return value schemas
- Request/response examples
- Categories and HTTP methods

### Execute Single Tool
```bash
POST /v1/mcp/:toolName
Content-Type: application/json
X-Auth-Key: your-secret-auth-key

{
  "name": "Test Agent",
  "entity_id": "test-123"
}
```

### Batch Execute Tools
```bash
POST /v1/mcp/batch
Content-Type: application/json
X-Auth-Key: your-secret-auth-key

{
  "tools": [
    {
      "name": "create_name",
      "input": {
        "name": "Agent Alpha",
        "entity_id": "agent-1"
      }
    },
    {
      "name": "create_identity",
      "input": {
        "entity_id": "agent-1"
      }
    }
  ]
}
```

## Testing

### Test the MCP API
```bash
# Start the service first
bun run dev

# In another terminal, run the test script
bun run packages/opus-nitro-sdk-mock/scripts/test-tools-api.ts
```

### Test Individual Endpoints
```bash
# List tools (both endpoints return same data)
curl -H "X-Auth-Key: your-secret-auth-key" http://localhost:3105/v1/mcp/
curl -H "X-Auth-Key: your-secret-auth-key" http://localhost:3105/v1/mcp/list_tools

# Create name
curl -X POST http://localhost:3105/v1/mcp/create_name \
  -H "Content-Type: application/json" \
  -H "X-Auth-Key: your-secret-auth-key" \
  -d '{"name": "Test Agent", "entity_id": "test-123"}'

# Create identity (requires existing name)
curl -X POST http://localhost:3105/v1/mcp/create_identity \
  -H "Content-Type: application/json" \
  -H "X-Auth-Key: your-secret-auth-key" \
  -d '{"entity_id": "test-123"}'
```

## Environment Variables

Required environment variables:
- `MOCK_AWS_NITRO_PRIV_KEY`: Mock private key for Nitro enclave simulation (required for DID creation)
- `OPUS_NITRO_AUTH_KEY`: Authentication key for API access (required for all endpoints except /health)
- `CDP_API_KEY_ID`: Coinbase CDP API Key ID
- `CDP_API_KEY_SECRET`: Coinbase CDP API Key Secret  
- `CDP_WALLET_SECRET`: Coinbase CDP Wallet Secret
- `OPUS_GENESIS_ID_URL`: URL for the opus-genesis-id service (default: http://localhost:3106)

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Run tests
bun test

# Test the Nitro DID service
bun run test:nitro-did
```

## Testing Scripts

- `pnpm test:nitro-did` - Test the Nitro DID service functionality
- `pnpm test:e2e` - Run end-to-end tests
- `pnpm test:claim` - Test claim handler functionality
- `pnpm create-identity` - Create a new identity using the services

## Security Note

🔒 **Authentication Required**: All endpoints except `/health` require an `X-Auth-Key` header that matches the `OPUS_NITRO_AUTH_KEY` environment variable. This provides basic API access control for the service. 