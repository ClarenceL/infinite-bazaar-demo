import { and, db, desc, entityContext, eq, isNull } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";

// Hardcoded entity ID for Opus agent
const OPUS_ENTITY_ID = "ent_opus";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  completedAt?: number | null; // timestamp when complete, null when streaming
}

export class ChatService {
  /**
   * Get recent messages for the Opus agent
   */
  async getMessages(limit = 50, includeCompleted = true): Promise<ChatMessage[]> {
    try {
      logger.info({ entityId: OPUS_ENTITY_ID, limit }, "Fetching messages from database");

      // Build where conditions
      const whereConditions = [
        eq(entityContext.entityId, OPUS_ENTITY_ID),
        eq(entityContext.contextType, "MESSAGE"), // Only get regular messages, not tool calls
      ];

      // If not including completed messages, filter to only streaming messages
      if (!includeCompleted) {
        whereConditions.push(isNull(entityContext.completedAt));
      }

      // Query database for messages, ordered by sequence/timestamp
      const dbMessages = await db
        .select({
          contextId: entityContext.contextId,
          role: entityContext.role,
          content: entityContext.content,
          sequence: entityContext.sequence,
          createdAt: entityContext.createdAt,
          completedAt: entityContext.completedAt,
        })
        .from(entityContext)
        .where(and(...whereConditions))
        .orderBy(desc(entityContext.sequence), desc(entityContext.createdAt))
        .limit(limit);

      // Convert database records to ChatMessage format
      const messages: ChatMessage[] = dbMessages.map((record) => ({
        id: record.contextId,
        role: record.role as "user" | "assistant" | "system",
        content: record.content,
        timestamp: record.createdAt?.getTime() || Date.now(),
        completedAt: record.completedAt?.getTime() || null,
      }));

      // Reverse to get chronological order (oldest first)
      messages.reverse();

      logger.info({ messageCount: messages.length }, "Messages fetched successfully");
      return messages;
    } catch (error) {
      logger.error({ error }, "Error fetching messages from database");
      throw error;
    }
  }

  /**
   * Get message count for the Opus agent
   */
  async getMessageCount(): Promise<number> {
    try {
      const result = await db
        .select({
          count: entityContext.contextId,
        })
        .from(entityContext)
        .where(
          and(eq(entityContext.entityId, OPUS_ENTITY_ID), eq(entityContext.contextType, "MESSAGE")),
        );

      return result.length;
    } catch (error) {
      logger.error({ error }, "Error getting message count");
      return 0;
    }
  }

  /**
   * Get only streaming messages (done = false) for efficient polling
   */
  async getStreamingMessages(): Promise<ChatMessage[]> {
    return this.getMessages(50, false); // Get streaming messages only
  }

  /**
   * Get the latest message timestamp for polling optimization
   */
  async getLatestMessageTimestamp(): Promise<number | null> {
    try {
      const result = await db
        .select({
          createdAt: entityContext.createdAt,
        })
        .from(entityContext)
        .where(
          and(eq(entityContext.entityId, OPUS_ENTITY_ID), eq(entityContext.contextType, "MESSAGE")),
        )
        .orderBy(desc(entityContext.createdAt))
        .limit(1);

      return result[0]?.createdAt?.getTime() || null;
    } catch (error) {
      logger.error({ error }, "Error getting latest message timestamp");
      return null;
    }
  }
}

// Export singleton instance
export const chatService = new ChatService();
