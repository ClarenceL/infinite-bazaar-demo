# InfiniteBazaar E2E Test Guide

This guide explains how to run the end-to-end test for the InfiniteBazaar claim submission flow with x402 payments and Coinbase CDP blockchain simulation.

## Test Flow Overview

The E2E test demonstrates the complete flow:

1. **Service Health Check**: Verifies both services are running
2. **Claim Submission**: opus-nitro-sdk-mock calls opus-genesis-id
3. **x402 Payment**: First call returns 402, x402-fetch handles payment automatically
4. **Payment Verification**: opus-genesis-id verifies the payment using x402-hono
5. **Blockchain Simulation**: Coinbase CDP simulates storing the claim on-chain
6. **Success Response**: Complete flow returns success with transaction details

## Prerequisites

### Environment Variables

Create `.env` files in both packages:

**packages/opus-nitro-sdk-mock/.env:**
```bash
# x402 Payment Configuration
X402_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
OPUS_GENESIS_ID_URL=http://localhost:3106

# Logging
LOG_LEVEL=info
```

**packages/opus-genesis-id/.env:**
```bash
# x402 Service Configuration
X402_SERVICE_WALLET_ADDRESS=0x742d35Cc6634C0532925a3b8D7389C4e5B2A8b1d
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_NETWORK=base-sepolia

# Coinbase CDP Configuration (optional)
CDP_API_KEY_NAME=default-key
CDP_PRIVATE_KEY=default-private-key

# Logging
LOG_LEVEL=info
```

### Required Dependencies

Both packages should have their dependencies installed:

```bash
# From root directory
pnpm install
```

## Running the Test

### Step 1: Start the Services

Open two terminal windows:

**Terminal 1 - Start opus-genesis-id:**
```bash
cd packages/opus-genesis-id
pnpm dev
```

**Terminal 2 - Start opus-nitro-sdk-mock:**
```bash
cd packages/opus-nitro-sdk-mock
pnpm dev
```

Wait for both services to start:
- opus-genesis-id: http://localhost:3106
- opus-nitro-sdk-mock: http://localhost:3105

### Step 2: Run the E2E Test

**Terminal 3 - Run the test:**
```bash
cd packages/opus-nitro-sdk-mock
bun run scripts/test-e2e-claim-flow.ts
```

## Expected Output

The test will produce a detailed report showing:

```
================================================================================
🧪 INFINITEBAZAAR E2E TEST REPORT
================================================================================
📅 Timestamp: 2024-01-15T10:30:00.000Z
⏱️  Duration: 2500ms
✅ Overall Success: PASS

📊 SERVICE STATUS:
  opus-nitro-sdk-mock: ✅ HEALTHY
  opus-genesis-id: ✅ HEALTHY

🔄 CLAIM SUBMISSION:
  Success: ✅
  Message: Claim submitted successfully with x402 payment

💳 PAYMENT FLOW:
  x402 Payment: ✅ PROCESSED
  Account: 0x742d35Cc6634C0532925a3b8D7389C4e5B2A8b1d

⛓️  BLOCKCHAIN SIMULATION:
  Transaction Hash: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
  Claim ID: claim_1705316200000_abc123
  Gas Used: 65000

================================================================================
🎉 ALL TESTS PASSED! InfiniteBazaar E2E flow is working correctly.
✅ x402 payment integration is functional
✅ Blockchain simulation with Coinbase CDP is working
✅ End-to-end claim submission flow is complete
================================================================================
```

## Test Components

### 1. Service Health Checks
- Verifies both services respond to `/health` endpoints
- Ensures services are ready to handle requests

### 2. Claim Submission Flow
- Calls `POST /enclave/test-claim` on opus-nitro-sdk-mock
- opus-nitro-sdk-mock calls `POST /genesis/claim/submit` on opus-genesis-id
- Tests the complete MCP tool handler flow

### 3. x402 Payment Integration
- First request returns HTTP 402 (Payment Required)
- x402-fetch automatically handles payment creation
- x402-hono middleware verifies payment on server side
- Request succeeds after payment verification

### 4. Blockchain Simulation
- Coinbase CDP client simulates wallet creation
- Mock transaction hash represents on-chain storage
- Demonstrates how claims would be stored on Base Sepolia

## Troubleshooting

### Services Not Starting
- Check port availability (3105, 3106)
- Verify environment variables are set
- Check logs for startup errors

### Payment Failures
- Verify x402 environment variables
- Check private key format (must start with 0x)
- Ensure wallet has sufficient funds for testnet

### Test Timeouts
- Increase timeout in test script if needed
- Check network connectivity
- Verify service response times

## Manual Testing

You can also test individual components:

**Test opus-nitro-sdk-mock directly:**
```bash
curl -X POST http://localhost:3105/enclave/test-claim \
  -H "Content-Type: application/json"
```

**Test opus-genesis-id directly:**
```bash
curl -X POST http://localhost:3106/genesis/claim/submit \
  -H "Content-Type: application/json" \
  -d '{
    "did": "did:iden3:polygon:amoy:x3HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ2H2",
    "claimType": "identity_verification",
    "claimData": {"verified": true}
  }'
```

This should return HTTP 402 with payment requirements. 