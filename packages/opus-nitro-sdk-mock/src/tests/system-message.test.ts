import { describe, expect, it, beforeEach, vi } from "vitest";
import { getSystemMessage, OPUS_ENTITY_ID } from "../agents/opus/utils/systemMessage";

// Mock the database module
vi.mock("@infinite-bazaar-demo/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
  entities: {
    cdp_name: "cdp_name",
    entityId: "entity_id",
  },
  eq: vi.fn(),
}));

describe("System Message", () => {
  beforeEach(() => {
    // Clear any cached data between tests
    vi.clearAllMocks();
  });

  it("should include entityId in system prompt when provided", async () => {
    // Test with custom entityId
    const testEntityId = "ent_test_agent_123";
    const systemMessage = await getSystemMessage(undefined, testEntityId);

    // Check if entityId is included
    expect(systemMessage).toContain(testEntityId);

    // Verify it appears in the expected sections
    expect(systemMessage).toContain(`Entity ID: ${testEntityId}`);
    expect(systemMessage).toContain("this is your technical identifier assigned by the system");
    expect(systemMessage).toContain("This ID is NOT your name");
  });

  it("should use default entityId when none provided", async () => {
    const systemMessage = await getSystemMessage();

    // Should contain the default OPUS_ENTITY_ID
    expect(systemMessage).toContain(OPUS_ENTITY_ID);
    expect(systemMessage).toContain(`Entity ID: ${OPUS_ENTITY_ID}`);
  });

  it("should include guidance about choosing a name vs entity ID", async () => {
    const testEntityId = "ent_custom_agent";
    const systemMessage = await getSystemMessage(undefined, testEntityId);

    // Should explain the difference between entity ID and chosen name
    expect(systemMessage).toContain("You should choose your own meaningful name");
    expect(systemMessage).toContain("Your chosen name will be how others know you");
    expect(systemMessage).toContain("not your entity ID");
    expect(systemMessage).toContain("just your system ID, not your name");
  });

  it("should include entityId in multiple sections of the prompt", async () => {
    const testEntityId = "ent_multi_test";
    const systemMessage = await getSystemMessage(undefined, testEntityId);

    const lines = systemMessage.split('\n');
    const entityIdLines = lines.filter(line => line.includes(testEntityId));

    // Should appear in at least 3 different places
    expect(entityIdLines.length).toBeGreaterThanOrEqual(3);

    // Should appear in specific sections
    const hasAssignedIdentitySection = entityIdLines.some(line =>
      line.includes("Entity ID:") && line.includes("technical identifier")
    );
    const hasCurrentStatusSection = entityIdLines.some(line =>
      line.includes("Entity ID:") && line.includes("system identifier")
    );
    const hasFirstQuestionsSection = entityIdLines.some(line =>
      line.includes("just your system ID")
    );

    expect(hasAssignedIdentitySection).toBe(true);
    expect(hasCurrentStatusSection).toBe(true);
    expect(hasFirstQuestionsSection).toBe(true);
  });

  it("should maintain other template variables alongside entityId", async () => {
    const testEntityId = "ent_template_test";
    const systemMessage = await getSystemMessage(
      {
        name: "TestAgent",
        balance: "25.50"
      },
      testEntityId
    );

    // Should include the custom template context
    expect(systemMessage).toContain("TestAgent");
    expect(systemMessage).toContain("25.50");

    // Should also include the entityId
    expect(systemMessage).toContain(testEntityId);

    // Should include wallet address (even if default)
    expect(systemMessage).toContain("Wallet:");

    // Should include timestamp
    expect(systemMessage).toContain("TIMESTAMP:");
  });

  it("should handle undefined entityId gracefully", async () => {
    const systemMessage = await getSystemMessage(undefined, undefined);

    // Should fall back to default OPUS_ENTITY_ID
    expect(systemMessage).toContain(OPUS_ENTITY_ID);
    expect(systemMessage).not.toContain("undefined");
    expect(systemMessage).not.toContain("{{entity_id}}");
  });

  it("should use default wallet values when no CDP name found and keep querying database", async () => {
    const testEntityId = "ent_no_cdp_name";
    const systemMessage = await getSystemMessage(undefined, testEntityId);

    // Should include default wallet values when no CDP name is found
    expect(systemMessage).toContain("0x...pending");
    expect(systemMessage).toContain("0.00 USDC");

    // Note: Since we don't cache null values, the database will be queried 
    // again on the next call until a CDP name is set by the create_identity process
  });
}); 