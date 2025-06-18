# Opus Genesis ID

x402 endpoint for Privado ID claim submission and genesis identity management.

## Overview

This package provides a Hono-based API server that accepts x402 payments for submitting Privado ID claims to blockchain storage contracts. It implements the genesis identity layer of the InfiniteBazaar protocol.

## Features

- **x402 Payment Integration**: Accepts USDC payments for claim submissions
- **Claim Validation**: Validates Privado ID claims using Zod schemas
- **Blockchain Storage**: Submits claims to storage contracts (placeholder implementation)
- **DID Mapping**: Maps DIDs to claim data with event tracking
- **RESTful API**: Clean HTTP endpoints for claim operations

## API Endpoints

### Service Information
- `GET /` - Service status and endpoint information
- `GET /genesis/info` - Detailed service information and pricing
- `GET /genesis/health` - Health check endpoint

### Claim Operations
- `POST /genesis/claim/submit` - Submit a claim with x402 payment
- `GET /genesis/claim/:did` - Retrieve claim by DID

## Usage

### Submit a Claim

```bash
curl -X POST http://localhost:3106/genesis/claim/submit \
  -H "Content-Type: application/json" \
  -d '{
    "claim": {
      "did": "did:iden3:polygon:amoy:...",
      "claimType": "identity_verification",
      "claimData": {
        "verified": true,
        "timestamp": "2024-01-01T00:00:00Z"
      },
      "signature": "0x..."
    },
    "payment": {
      "amount": 1,
      "currency": "USDC",
      "paymentProof": "0x...",
      "payerAddress": "0x..."
    }
  }'
```

### Get Claim by DID

```bash
curl http://localhost:3106/genesis/claim/did:iden3:polygon:amoy:...
```

## Configuration

Set environment variables:

```bash
export OPUS_GENESIS_ID_PORT=3106
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Architecture

- **ClaimService**: Handles x402 payment verification and blockchain submission
- **GenesisService**: Orchestrates the complete claim submission process
- **Genesis Routes**: HTTP endpoints for claim operations
- **Middleware**: Custom logging and error handling

## Pricing

- **Claim Submission**: 1 USDC per claim
- **Payment Method**: x402 protocol
- **Supported Currency**: USDC

## TODO

- [ ] Implement actual x402 payment verification
- [ ] Add blockchain storage contract integration
- [ ] Implement claim retrieval from blockchain
- [ ] Add pagination for claim listing
- [ ] Add admin endpoints for claim management
- [ ] Implement event tracking for claim changes 