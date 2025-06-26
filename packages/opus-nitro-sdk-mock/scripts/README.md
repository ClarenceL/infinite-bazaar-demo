# Opus Nitro SDK Mock Scripts

## Scripts

### `seed-default-data.ts`

A seed script that creates the default data required for the Opus agent to function properly.

**What it creates:**
- Default entity: `ent_opus` (AI type, name: "Opus")
- Default global chat: `chat_global` (name: "Global Chat", is_global: true)

**How to run:**
```bash
# From the opus-nitro-sdk-mock package directory
pnpm seed:default-data

# Or directly with tsx
tsx scripts/seed-default-data.ts
```

**Prerequisites:**
- Database must be running and accessible via `DATABASE_URL` environment variable
- Database tables must exist (run database migrations if needed)

**What the script does:**
1. Checks if the Opus entity already exists, creates or updates it
2. Checks if the global chat already exists, creates or updates it
3. Verifies the seeded data by querying the database
4. Shows existing message count for the Opus entity

**Safe to run multiple times** - The script uses upsert logic (INSERT or UPDATE) so it won't create duplicates.

## Test Scripts

### `test-opus-chat.ts`

A comprehensive test script that demonstrates the Opus agent's chat functionality with database persistence.

**What it tests:**
- Opus agent information retrieval
- Message saving to database (`entity_context` table)
- Message loading from database with proper filtering
- Tool call and tool result message handling
- LLM message preparation following Lyra MCP server pattern
- Conversation reset functionality

**How to run:**
```bash
# From the opus-nitro-sdk-mock package directory
pnpm test:opus-chat

# Or directly with tsx
tsx scripts/test-opus-chat.ts
```

**Prerequisites:**
- Database must be running and accessible via `DATABASE_URL` environment variable
- The `entity_context` table must exist (run database migrations if needed)

**What the test does:**
1. Gets Opus agent info (including message count from database)
2. Saves a user message to database
3. Generates a mock response
4. Saves the assistant's response
5. Tests tool call message saving
6. Tests tool result message saving
7. Loads and displays the full conversation history
8. Tests LLM message preparation
9. Tests conversation reset

**Database Integration:**
The test script validates that the Opus service properly:
- Stores messages in the `entity_context` table with proper sequencing
- Handles different message types (MESSAGE, TOOL_USE, TOOL_RESULT)
- Filters messages by `chatId` when specified
- Maintains message order using the `sequence` field
- Converts between internal `Message` format and database schema

This script is essential for validating the database integration before connecting to actual LLM services.

### `test-auth-claim.ts`

A test script that validates proper Iden3 AuthClaim creation following the official documentation pattern.

**What it tests:**
- Proper AuthClaim creation with Baby Jubjub keypair
- Creation of the three identity trees (Claims, Revocation, Roots)
- Adding AuthClaim to Claims tree with correct hIndex and hValue
- Identity State calculation as hash of tree roots
- AuthClaim verification using Merkle proof

**How to run:**
```bash
# From the opus-nitro-sdk-mock package directory
tsx scripts/test-auth-claim.ts
```

**Prerequisites:**
- `MOCK_AWS_NITRO_PRIV_KEY` environment variable must be set

**What the test does:**
1. Initializes the Iden3AuthClaimService
2. Creates AuthClaim with proper tree structure following [Iden3 docs](https://docs.iden3.io/getting-started/identity/identity-state/#create-identity-trees-and-add-authclaim)
3. Verifies the AuthClaim using Merkle proof
4. Displays detailed results including Identity State, tree roots, and public key coordinates

**Technical Details:**
- Creates Baby Jubjub keypair for AuthClaim
- Extracts X and Y coordinates from public key
- Creates three 40-level Sparse Merkle Trees
- Uses `core.NewClaim` with `core.AuthSchemaHash`
- Calculates Identity State as `Hash(ClR || ReR || RoR)`
- Follows the exact pattern from Iden3 documentation

This script validates that the AuthClaim implementation correctly follows the Iden3 protocol specifications. 