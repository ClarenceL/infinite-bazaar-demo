import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPUS_ENTITY_ID, getSystemMessage } from "../agents/utils/system-message";

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
    // Test with OPUS entityId
    const testEntityId = OPUS_ENTITY_ID;
    const systemMessage = await getSystemMessage(testEntityId);

    // Check if entityId is included
    expect(systemMessage).toContain(testEntityId);

    // Verify it appears in the expected sections
    expect(systemMessage).toContain(`Entity ID: ${testEntityId}`);
    expect(systemMessage).toContain("this is your technical identifier assigned by the system");
    expect(systemMessage).toContain("This ID is NOT your name");
  });

  it("should throw error when entityId is not provided", async () => {
    // Test that function throws when entityId is missing
    await expect(getSystemMessage("")).rejects.toThrow("entityId is required");

    // Test with null/undefined-like values
    await expect(getSystemMessage(null as any)).rejects.toThrow("entityId is required");
    await expect(getSystemMessage(undefined as any)).rejects.toThrow("entityId is required");
  });

  it("should include guidance about choosing a name vs entity ID", async () => {
    const testEntityId = OPUS_ENTITY_ID;
    const systemMessage = await getSystemMessage(testEntityId);

    // Should explain the difference between entity ID and chosen name
    expect(systemMessage).toContain("You should choose your own meaningful name");
    expect(systemMessage).toContain("Your chosen name will be how others know you");
    expect(systemMessage).toContain("not your entity ID");
    expect(systemMessage).toContain("just your system ID, not your name");
  });

  it("should include entityId in multiple sections of the prompt", async () => {
    const testEntityId = OPUS_ENTITY_ID;
    const systemMessage = await getSystemMessage(testEntityId);

    const lines = systemMessage.split("\n");
    const entityIdLines = lines.filter((line) => line.includes(testEntityId));

    // Should appear in at least 3 different places
    expect(entityIdLines.length).toBeGreaterThanOrEqual(3);

    // Should appear in specific sections
    const hasAssignedIdentitySection = entityIdLines.some(
      (line) => line.includes("Entity ID:") && line.includes("technical identifier"),
    );
    const hasCurrentStatusSection = entityIdLines.some(
      (line) => line.includes("Entity ID:") && line.includes("system identifier"),
    );
    const hasFirstQuestionsSection = entityIdLines.some((line) =>
      line.includes("just your system ID"),
    );

    expect(hasAssignedIdentitySection).toBe(true);
    expect(hasCurrentStatusSection).toBe(true);
    expect(hasFirstQuestionsSection).toBe(true);
  });

  it("should maintain other template variables alongside entityId", async () => {
    const testEntityId = OPUS_ENTITY_ID;
    const systemMessage = await getSystemMessage(testEntityId, {
      name: "TestAgent",
      balance: "25.50",
    });

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

  it("should throw error for unknown entity ID", async () => {
    const unknownEntityId = "ent_unknown_agent";

    // Should throw when no prompt is found for the entity
    await expect(getSystemMessage(unknownEntityId)).rejects.toThrow(
      `No system prompt found for entity ID: ${unknownEntityId}`,
    );
  });

  it("should use default wallet values when no CDP name found and keep querying database", async () => {
    const testEntityId = OPUS_ENTITY_ID; // Use known entity ID
    const systemMessage = await getSystemMessage(testEntityId);

    // Should include default wallet values when no CDP name is found
    expect(systemMessage).toContain("0x...pending");
    expect(systemMessage).toContain("0.00");

    // Should include the message about needing to create identity
    expect(systemMessage).toContain(
      "You will be given a starting balance after you create your identity",
    );

    // Note: Since we don't cache null values, the database will be queried
    // again on the next call until a CDP name is set by the create_identity process
  });

  it("should show different balance messages based on CDP name availability", async () => {
    const testEntityId = OPUS_ENTITY_ID; // Use known entity ID

    // Test without CDP name (mocked to return null)
    const systemMessageWithoutCdp = await getSystemMessage(testEntityId);
    expect(systemMessageWithoutCdp).toContain(
      "You will be given a starting balance after you create your identity",
    );
    expect(systemMessageWithoutCdp).not.toContain("USDC (use this wisely)");

    // The message should not contain the old hardcoded USDC text
    expect(systemMessageWithoutCdp).not.toContain("USDC (your entire starting lifeline)");
  });
});
