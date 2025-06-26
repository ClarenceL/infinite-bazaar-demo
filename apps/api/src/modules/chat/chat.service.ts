import {
  and,
  db,
  desc,
  entities,
  entityContext,
  eq,
  isNull,
  ne,
  or,
} from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  completedAt?: number | null; // timestamp when complete, null when streaming
  entityId: string; // Add entityId to the interface
  entityName?: string; // Add optional entity name
  contextType: "MESSAGE" | "TOOL_USE" | "TOOL_RESULT"; // Add context type
  toolName?: string; // For tool use/result messages
  toolResultData?: any; // For tool result data
}

export class ChatService {
  /**
   * Get recent messages for specified entity or all entities
   */
  async getMessages(
    limit = 50,
    includeCompleted = true,
    entityId?: string,
    excludeUserMessages = false,
  ): Promise<ChatMessage[]> {
    try {
      logger.info({ entityId, limit }, "Fetching messages from database");

      // Build where conditions with complex filtering logic
      const whereConditions = [];

      // Add entity filter if specified
      if (entityId) {
        whereConditions.push(eq(entityContext.entityId, entityId));
      }

      if (excludeUserMessages) {
        // Complex filtering when excluding user messages:
        // We need to query TOOL_USE messages to get tool names, but filter them out later
        // 1. Include MESSAGE context_type with role = assistant
        // 2. Include TOOL_USE context_type (to get tool names for mapping)
        // 3. Include TOOL_RESULT context_type with role = user (tool results should be shown)
        whereConditions.push(
          or(
            and(eq(entityContext.contextType, "MESSAGE"), eq(entityContext.role, "assistant")),
            eq(entityContext.contextType, "TOOL_USE"),
            and(eq(entityContext.contextType, "TOOL_RESULT"), eq(entityContext.role, "user")),
          ),
        );
      } else {
        // When not excluding user messages, include MESSAGE and TOOL_RESULT context types
        whereConditions.push(
          or(
            eq(entityContext.contextType, "MESSAGE"),
            eq(entityContext.contextType, "TOOL_RESULT"),
          ),
        );
      }

      // If not including completed messages, filter to only streaming messages
      if (!includeCompleted) {
        whereConditions.push(isNull(entityContext.completedAt));
      }

      // Query database for messages with entity info, ordered by sequence/timestamp
      const dbMessages = await db
        .select({
          contextId: entityContext.contextId,
          role: entityContext.role,
          content: entityContext.content,
          sequence: entityContext.sequence,
          createdAt: entityContext.createdAt,
          completedAt: entityContext.completedAt,
          entityId: entityContext.entityId,
          entityName: entities.name, // Get the actual name from entities table
          contextType: entityContext.contextType,
          toolName: entityContext.toolName,
          toolUseId: entityContext.toolUseId,
          toolResultData: entityContext.toolResultData,
        })
        .from(entityContext)
        .leftJoin(entities, eq(entityContext.entityId, entities.entityId)) // Join with entities table
        .where(and(...whereConditions))
        .orderBy(desc(entityContext.createdAt))
        .limit(limit);

      // Create a mapping of toolUseId to toolName from TOOL_USE messages
      const toolUseMap = new Map<string, string>();
      dbMessages.forEach((record) => {
        if (record.contextType === "TOOL_USE" && record.toolUseId && record.toolName) {
          toolUseMap.set(record.toolUseId, record.toolName);
        }
      });

      // Convert database records to ChatMessage format and filter out TOOL_USE messages
      const allMessages: ChatMessage[] = dbMessages
        .filter((record) => {
          // Filter out TOOL_USE messages when excludeUserMessages is true
          if (excludeUserMessages && record.contextType === "TOOL_USE") {
            return false;
          }
          return true;
        })
        .map((record) => {
          // Get tool name from TOOL_USE mapping for TOOL_RESULT messages
          let toolName = record.toolName;
          if (record.contextType === "TOOL_RESULT" && record.toolUseId) {
            toolName = toolUseMap.get(record.toolUseId) || toolName;
          }

          return {
            id: record.contextId,
            role: record.role as "user" | "assistant" | "system",
            content: record.content,
            timestamp: record.createdAt?.getTime() || Date.now(),
            completedAt: record.completedAt?.getTime() || null,
            entityId: record.entityId,
            // Use the actual name from entities table, fallback to "Unnamed" if null
            entityName: record.entityName || "Unnamed",
            contextType: record.contextType as "MESSAGE" | "TOOL_USE" | "TOOL_RESULT",
            toolName: toolName || undefined,
            toolResultData: record.toolResultData || undefined,
          };
        });

      const messages = allMessages;

      // Reverse to get chronological order (oldest first)
      messages.reverse();

      logger.info({ messageCount: messages.length, entityId }, "Messages fetched successfully");
      return messages;
    } catch (error) {
      logger.error({ error, entityId }, "Error fetching messages from database");
      throw error;
    }
  }

  /**
   * Get only streaming messages for efficient polling
   */
  async getStreamingMessages(
    entityId?: string,
    excludeUserMessages = false,
  ): Promise<ChatMessage[]> {
    return this.getMessages(50, false, entityId, excludeUserMessages);
  }

  /**
   * Get message count for specified entity or all entities
   */
  async getMessageCount(entityId?: string): Promise<number> {
    try {
      const whereConditions = [eq(entityContext.contextType, "MESSAGE")];

      if (entityId) {
        whereConditions.push(eq(entityContext.entityId, entityId));
      }

      const result = await db
        .select({
          count: entityContext.contextId,
        })
        .from(entityContext)
        .where(and(...whereConditions));

      return result.length;
    } catch (error) {
      logger.error({ error, entityId }, "Error getting message count");
      return 0;
    }
  }

  /**
   * Get the latest message timestamp for polling optimization
   */
  async getLatestMessageTimestamp(entityId?: string): Promise<number | null> {
    try {
      const whereConditions = [eq(entityContext.contextType, "MESSAGE")];

      if (entityId) {
        whereConditions.push(eq(entityContext.entityId, entityId));
      }

      const result = await db
        .select({
          createdAt: entityContext.createdAt,
        })
        .from(entityContext)
        .where(and(...whereConditions))
        .orderBy(desc(entityContext.createdAt))
        .limit(1);

      return result[0]?.createdAt?.getTime() || null;
    } catch (error) {
      logger.error({ error, entityId }, "Error getting latest message timestamp");
      return null;
    }
  }
}

// Export singleton instance
export const chatService = new ChatService();
