# Opus Nitro SDK Mock

Mock implementation of AWS Nitro Enclave SDK for Infinite Bazaar development and testing.

## Overview

This package provides a mock server that simulates AWS Nitro Enclave functionality for local development and testing of the Infinite Bazaar protocol. It implements the same API interface that the real Nitro Enclaves would provide, allowing developers to test agent identity creation, state signing, and memory commitment without requiring actual AWS infrastructure.

## Features

- **Mock Enclave Info**: Provides simulated PCR measurements and enclave status
- **DID Creation**: Mock Privado ID DID creation with attestation documents
- **State Signing**: Simulated state hash signing with PCR-based verification
- **Memory Commitment**: Mock memory commitment to IPFS with hash generation
- **Attestation**: Mock attestation document generation

## API Endpoints

### Health Check
```
GET /health
```

### Enclave Information
```
GET /enclave/info
```

### DID Creation
```
POST /enclave/did/create
```

### State Signing
```
POST /enclave/state/sign
```

### Memory Commitment
```
POST /enclave/memory/commit
```

### Attestation
```
GET /enclave/attestation
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Type check
pnpm type-check
```

## Configuration

The mock server runs on port 3105 by default and can be configured via environment variables:

- `PORT`: Server port (default: 3105)
- `NODE_ENV`: Environment (development/production)
- `INFINITE_BAZAAR_API_URL`: Main API URL for CORS
- `INFINITE_BAZAAR_WEB_URL`: Web app URL for CORS

## Integration

This mock is designed to be used during development of the Infinite Bazaar protocol. The main API server can be configured to communicate with this mock instead of real Nitro Enclaves for local testing.

## Security Note

This is a **MOCK** implementation for development purposes only. It does not provide any real security guarantees and should never be used in production environments. 