# Opus Genesis ID

An x402-enabled DID claim submission service for the InfiniteBazaar protocol. This service accepts payments via the x402 protocol and stores DID claims on IPFS and Base Sepolia.

## Features

- **x402 Payment Protocol**: Accept USDC payments automatically via HTTP 402 status codes
- **DID Claim Storage**: Store and retrieve DID claims with cryptographic verification
- **Blockchain Integration**: Store claim hashes on Base Sepolia for immutable records
- **IPFS Storage**: Distributed storage for claim data
- **Real-time Payment Verification**: Instant payment settlement using stablecoins

## x402 Integration

This service implements the x402 payment protocol using `x402-hono` middleware:

- **Payment Required**: Claims submission requires 1 USDC payment
- **Automatic Verification**: Payments are verified automatically by the x402 middleware
- **Instant Settlement**: Payments settle in ~200ms on Base Sepolia
- **No Chargebacks**: Blockchain-based payments are final and irreversible

## Installation

```bash
pnpm install
```

## Configuration

Set the following environment variables:

```bash
# x402 Configuration (required for payment processing)
X402_SERVICE_WALLET_ADDRESS=0x742d35Cc6635C0532925a3b8D6Ac6c0532925a3b
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_NETWORK=base-sepolia

# Server Configuration
PORT=3106
NODE_ENV=development
LOG_LEVEL=info
```

## Usage

### Start the Server

```bash
# Development mode
pnpm dev

# Production mode
pnpm build && pnpm start
```

### API Endpoints

#### GET `/genesis/info`
Get service information and pricing (no payment required).

**Response:**
```json
{
  "service": "InfiniteBazaar Genesis ID Service",
  "version": "1.0.0",
  "description": "x402-enabled DID claim submission service",
  "pricing": {
    "claimSubmission": "$1.00 USDC"
  },
  "network": "base-sepolia",
  "facilitator": "https://x402.org/facilitator",
  "payTo": "0x742d35Cc6635C0532925a3b8D6Ac6c0532925a3b",
  "x402Enabled": true
}
```

#### POST `/genesis/claim/submit`
Submit a DID claim with x402 payment (requires 1 USDC payment).

**Request Body:**
```json
{
  "did": "did:iden3:polygon:amoy:x3HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ2H2",
  "claimType": "identity_verification",
  "claimData": {
    "verified": true,
    "verificationMethod": "enclave_attestation",
    "timestamp": "2025-01-27T10:30:00Z"
  },
  "issuer": "did:iden3:polygon:amoy:x1HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ1H1",
  "subject": "did:iden3:polygon:amoy:x3HstHLj2rTp6HHXk2WczYP7w3rpCsRbwCMeaQ2H2"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Claim submitted successfully",
  "claimId": "claim_1706356200000_abc123",
  "timestamp": "2025-01-27T10:30:00Z",
  "paymentVerified": true,
  "paymentMethod": "x402"
}
```

#### GET `/genesis/claim/:did`
Retrieve a claim by DID (no payment required).

#### GET `/genesis/health`
Health check endpoint (no payment required).

## x402 Payment Flow

1. **Client Request**: Client makes a request to `/genesis/claim/submit` without payment
2. **Payment Required**: Server responds with HTTP 402 and payment requirements
3. **Payment Authorization**: Client creates and signs payment authorization
4. **Retry with Payment**: Client retries request with `X-PAYMENT` header
5. **Payment Verification**: x402 middleware verifies payment automatically
6. **Claim Processing**: Server processes the claim and returns success
7. **Payment Settlement**: Payment is settled on Base Sepolia blockchain

## Testing

### Test x402 Integration

```bash
# Set environment variables
export X402_SERVICE_WALLET_ADDRESS=0x742d35Cc6635C0532925a3b8D6Ac6c0532925a3b
export X402_PRIVATE_KEY=0x1234567890abcdef...

# Run integration test
pnpm run test:x402
```

### Manual Testing

```bash
# Test service info (no payment)
curl http://localhost:3106/genesis/info

# Test claim submission (requires x402 client)
# Use opus-nitro-sdk-mock or x402-fetch client
```

## Client Integration

To integrate with this service, use an x402-enabled client:

### Using x402-fetch

```typescript
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "x402-fetch";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

const response = await fetchWithPayment('http://localhost:3106/genesis/claim/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(claimData)
});
```

### Using opus-nitro-sdk-mock

```typescript
import { handleClaim } from "@infinite-bazaar-demo/opus-nitro-sdk-mock";

const result = await handleClaim();
console.log(result.data);
```

## Development

### Project Structure

```
src/
├── modules/
│   └── genesis/
│       ├── genesis.routes.ts    # x402-enabled API routes
│       └── genesis.service.ts   # Business logic
├── services/
│   └── claim-service.ts         # Claim validation and storage
└── pkg/
    └── middleware/              # Custom middleware
```

### Key Dependencies

- `x402-hono`: x402 payment middleware for Hono
- `hono`: Web framework
- `viem`: Ethereum client
- `zod`: Schema validation

## Architecture

The service follows the x402 protocol specification:

1. **Payment Middleware**: `x402-hono` handles payment verification
2. **Claim Processing**: Business logic processes verified claims
3. **Storage**: Claims stored on IPFS with hashes on Base Sepolia
4. **Monitoring**: Comprehensive logging and error handling

## Security

- **Payment Verification**: All payments verified on-chain
- **No Stored Keys**: Private keys managed externally
- **Input Validation**: All inputs validated with Zod schemas
- **Rate Limiting**: Built-in protection against abuse
- **CORS**: Configured for production deployment

## License

Apache 2.0 