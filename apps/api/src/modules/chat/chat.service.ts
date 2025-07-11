import {
  and,
  chats,
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
    instanceId?: string,
  ): Promise<ChatMessage[]> {
    try {
      const actualInstanceId = instanceId || "default";
      logger.info({ entityId, instanceId: actualInstanceId, limit }, "Fetching messages from database");

      // Build where conditions with complex filtering logic
      const whereConditions = [
        eq(entityContext.instanceId, actualInstanceId)
      ];

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
        const exclusionConditions = [
          and(eq(entityContext.contextType, "MESSAGE"), eq(entityContext.role, "assistant")),
          eq(entityContext.contextType, "TOOL_USE"),
          and(eq(entityContext.contextType, "TOOL_RESULT"), eq(entityContext.role, "user")),
        ];
        whereConditions.push(or(...exclusionConditions));
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
    instanceId?: string,
  ): Promise<ChatMessage[]> {
    return this.getMessages(50, false, entityId, excludeUserMessages, instanceId);
  }

  /**
   * Get message count for specified entity or all entities
   */
  async getMessageCount(entityId?: string, instanceId?: string): Promise<number> {
    try {
      const actualInstanceId = instanceId || "default";
      const whereConditions = [
        eq(entityContext.contextType, "MESSAGE"),
        eq(entityContext.instanceId, actualInstanceId)
      ];

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
      const actualInstanceId = instanceId || "default";
      logger.error({ error, entityId, instanceId: actualInstanceId }, "Error getting message count");
      return 0;
    }
  }

  /**
   * Get the latest message timestamp for polling optimization
   */
  async getLatestMessageTimestamp(entityId?: string, instanceId?: string): Promise<number | null> {
    try {
      const actualInstanceId = instanceId || "default";
      const whereConditions = [
        eq(entityContext.contextType, "MESSAGE"),
        eq(entityContext.instanceId, actualInstanceId)
      ];

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
      const actualInstanceId = instanceId || "default";
      logger.error({ error, entityId, instanceId: actualInstanceId }, "Error getting latest message timestamp");
      return null;
    }
  }

  /**
   * Get entity count for a specific instance
   */
  async getInstanceEntityCount(instanceId: string): Promise<number> {
    try {
      const result = await db
        .select({
          count: entities.entityId,
        })
        .from(entities)
        .where(eq(entities.instanceId, instanceId));

      return result.length;
    } catch (error) {
      logger.error({ error, instanceId }, "Error getting instance entity count");
      return 0;
    }
  }

  /**
   * Create a new instance with seed data
   */
  async createInstance(instanceId: string): Promise<{ entityCount: number }> {
    try {
      logger.info({ instanceId }, "Creating new instance with seed data");

      // Define the entities to seed (minimal set for clean demos)
      const ENTITIES_TO_SEED = [
        {
          entity_id: "ent_collector_001",
          entity_type: "AI",
          name: "Avant-Garde Collector",
          cdp_address: "0x4b3cc6e047AF244356553b58460d28455765d763",
          active: true,
          cdp_name: "Avant-Garde-Collector",
          ai_prompt_id: "collector_buyer",
          anthropic_model: "claude-3-5-sonnet-20240620",
          chat_order: 1,
        },
        {
          entity_id: "ent_minimalist_001",
          entity_type: "AI",
          name: "Zen ASCII Master",
          cdp_address: "0x3CF8DdFa52f656530acB630E8F64A3980876A892",
          active: true,
          cdp_name: "Zen-ASCII-Master",
          ai_prompt_id: "minimalist_artist",
          anthropic_model: "claude-3-5-sonnet-20240620",
          chat_order: 2,
        },
        {
          entity_id: "ent_retro_001",
          entity_type: "AI",
          name: "Pixel Nostalgia",
          cdp_address: "0x83745B8496c2F345C4011B91dDD6c0E798687CB8",
          active: true,
          cdp_name: "Pixel-Nostalgia",
          ai_prompt_id: "retro_artist",
          anthropic_model: "claude-3-5-sonnet-20240620",
          chat_order: 3,
        },
      ];

      // Insert entities for this instance
      for (const entity of ENTITIES_TO_SEED) {
        const entityWithInstance = {
          ...entity,
          instanceId: instanceId,
          lastQueryTime: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db
          .insert(entities)
          .values({
            entityId: entity.entity_id,
            instanceId: instanceId,
            entityType: entity.entity_type as "AI" | "HUMAN",
            name: entity.name,
            cdpAddress: entity.cdp_address,
            active: entity.active,
            cdpName: entity.cdp_name,
            aiPromptId: entity.ai_prompt_id,
            anthropicModel: entity.anthropic_model,
            chatOrder: entity.chat_order,
            lastQueryTime: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: entities.entityId,
            set: {
              instanceId: instanceId,
              entityType: entity.entity_type as "AI" | "HUMAN",
              name: entity.name,
              cdpAddress: entity.cdp_address,
              active: entity.active,
              cdpName: entity.cdp_name,
              aiPromptId: entity.ai_prompt_id,
              anthropicModel: entity.anthropic_model,
              chatOrder: entity.chat_order,
              updatedAt: new Date(),
            },
          });
      }

      // Create global chat for this instance
      await db
        .insert(chats)
        .values({
          chatId: "chat_global",
          instanceId: instanceId,
          name: "Global Chat",
          isGlobal: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: chats.chatId,
          set: {
            instanceId: instanceId,
            name: "Global Chat",
            isGlobal: true,
            updatedAt: new Date(),
          },
        });

      logger.info({ instanceId, entityCount: ENTITIES_TO_SEED.length }, "Instance created successfully");

      return { entityCount: ENTITIES_TO_SEED.length };
    } catch (error) {
      logger.error({ error, instanceId }, "Error creating instance");
      throw error;
    }
  }
}

// Export singleton instance
export const chatService = new ChatService();
