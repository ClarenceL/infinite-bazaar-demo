# Blockchain Publication Status

## Current Implementation: **Mock/Simulation Only**

The current AuthClaim implementation **does NOT write to the blockchain by default**. Here's what's happening:

### 🔍 **What's Currently Working:**

1. **✅ Proper Iden3 AuthClaim Creation**: Following the [official Iden3 documentation](https://docs.iden3.io/getting-started/identity/identity-state/#create-identity-trees-and-add-authclaim)
2. **✅ Three Merkle Trees**: Claims, Revocation, and Roots trees created correctly
3. **✅ Identity State Calculation**: `Hash(ClR || ReR || RoR)` computed properly
4. **✅ Local Verification**: AuthClaim can be verified using Merkle proofs
5. **✅ Mock Blockchain Publication**: Simulated transaction hashes and block numbers

### 🚨 **What's NOT Happening:**

- **No real blockchain transactions**
- **No state transitions published to Polygon ID State Contract**
- **No on-chain verification possible**

## 🔧 **How to Enable Real Blockchain Publication**

### Step 1: Set Environment Variable

```bash
# Enable real blockchain publication
PUBLISH_TO_BLOCKCHAIN=true
```

### Step 2: Configure Blockchain Wallet

You'll need to set up a funded wallet for gas fees:

```bash
# Polygon Amoy testnet configuration
BLOCKCHAIN_PRIVATE_KEY=your_private_key_here
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology/
```

### Step 3: Implement State Transition Logic

The following needs to be implemented in `Iden3AuthClaimService.publishIdentityStateOnChain()`:

```typescript
// TODO: Real implementation would involve:
// 1. Generate state transition proof
// 2. Call Polygon ID State Contract's transitState function
// 3. Pay gas fees
// 4. Wait for transaction confirmation
```

## 📋 **Current Blockchain Configuration**

```typescript
const NETWORK_CONFIG = {
  rpcUrl: "https://rpc-amoy.polygon.technology/",
  contractAddress: "0x1a4cC30f2aA0377b0c3bc9848766D90cb4404124", // Amoy testnet State contract
  chainId: 80002,
  networkId: "amoy",
  networkName: "amoy",
};
```

## 🎯 **What Would Real Implementation Look Like?**

### State Transition Process:

1. **Generate Proof**: Create a zero-knowledge proof of the state transition
2. **Smart Contract Call**: Call `transitState()` on the Polygon ID contract
3. **Gas Payment**: Pay transaction fees in MATIC
4. **Confirmation**: Wait for blockchain confirmation
5. **Verification**: Identity State becomes verifiable on-chain

### Required Dependencies:

```typescript
import { createPublicClient, createWalletClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
```

### Example Transaction:

```typescript
const walletClient = createWalletClient({
  account: privateKeyToAccount(process.env.BLOCKCHAIN_PRIVATE_KEY),
  chain: polygonAmoy,
  transport: http(NETWORK_CONFIG.rpcUrl),
});

const hash = await walletClient.writeContract({
  address: NETWORK_CONFIG.contractAddress,
  abi: stateContractABI,
  functionName: 'transitState',
  args: [
    identity.id,
    oldState,
    newState,
    isOldStateGenesis,
    proof.a,
    proof.b,
    proof.c,
  ],
});
```

## 🔍 **How to Verify Current Status**

### In the UI:
- Look for "Blockchain Status" in the AuthClaim section
- **"✓ Published"** = Real blockchain transaction
- **"⚠ Mock/Failed"** = Simulated/failed transaction

### In the Logs:
```bash
# Mock publication
"Mock: Identity State published to blockchain"

# Real publication (not implemented)
"Identity State published to Polygon ID State Contract"
```

## 🚀 **For Production Use:**

1. **Implement Real State Transitions**: Complete the blockchain publication logic
2. **Add Gas Management**: Handle transaction fees and retries
3. **Add Error Handling**: Proper blockchain error handling
4. **Add Monitoring**: Track on-chain state transitions
5. **Security Audit**: Ensure secure key management

## 📖 **References:**

- [Iden3 State Transition Documentation](https://docs.iden3.io/getting-started/identity/identity-state/)
- [Polygon ID Smart Contracts](https://github.com/iden3/contracts)
- [Polygon Amoy Testnet](https://polygon.technology/blog/introducing-the-amoy-testnet-for-polygon-pos)

---

**Current Status**: Mock implementation ready for development and testing. Real blockchain publication requires additional implementation work. 