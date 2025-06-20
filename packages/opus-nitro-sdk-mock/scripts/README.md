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