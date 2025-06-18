import { and, db, desc, entityContext, eq, sql } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";
import { prepLLMMessages, processLangChainStream } from "../../agents/opus/utils";
import type {
  ChatMessage,
  ChatRequest,
  Message,
  OpusInfo,
  ToolCall,
  ToolCallResult,
} from "../../types/message";
import { generateResponse, generateStreamingResponse } from "./generate-response";

// Hardcoded entity ID for Opus agent
const OPUS_ENTITY_ID = "ent_opus";

export class OpusService {
  /**
   * Get Opus agent information
   */
  async getOpusInfo(): Promise<OpusInfo> {
    logger.info("Getting Opus agent information");

    // Get message count from database
    const messageCount = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(entityContext)
      .where(eq(entityContext.entityId, OPUS_ENTITY_ID));

    return {
      entityId: OPUS_ENTITY_ID,
      systemPrompt: "Opus AI agent for InfiniteBazaar protocol demonstration",
      messageCount: messageCount[0]?.count || 0,
      status: "active",
      capabilities: [
        "DID creation and management",
        "Wallet operations and x402 payments",
        "Memory commitment to IPFS and Base Sepolia",
        "State hash signing for tamper detection",
        "Social interactions with other entities",
      ],
    };
  }

  /**
   * Get system prompt for Opus agent
   */
  getSystemPrompt(): string {
    return "Opus AI agent for InfiniteBazaar protocol demonstration";
  }

  /**
   * Load message history for the agent from database
   */
  async loadMessages(chatId?: string): Promise<Message[]> {
    try {
      logger.info({ chatId, entityId: OPUS_ENTITY_ID }, "Loading message history from database");

      // Build query conditions
      const conditions = [eq(entityContext.entityId, OPUS_ENTITY_ID)];
      if (chatId) {
        conditions.push(eq(entityContext.chatId, chatId));
      }

      // Query database for messages
      const dbMessages = await db
        .select()
        .from(entityContext)
        .where(and(...conditions))
        .orderBy(entityContext.sequence, entityContext.createdAt);

      // Convert database records to Message format
      const messages: Message[] = dbMessages.map((record) => {
        let content: string | ToolCall | ToolCallResult;

        // Handle different context types
        if (record.contextType === "TOOL_USE" && record.toolName) {
          content = {
            type: "tool_use",
            name: record.toolName,
            id: record.toolId || "",
            input: record.toolInput || {},
            tool_use_id: record.toolUseId || undefined,
          };
        } else if (record.contextType === "TOOL_RESULT") {
          content = {
            type: "tool_result",
            tool_use_id: record.toolUseId || "",
            data: record.toolResultData || {},
          };
        } else {
          content = record.content;
        }

        return {
          role: record.role as "user" | "assistant" | "system",
          content,
          timestamp: record.createdAt?.getTime(),
          chatId: record.chatId || undefined,
        };
      });

      logger.info({ messageCount: messages.length, chatId }, "Messages loaded from database");
      return messages;
    } catch (error) {
      logger.error({ error, chatId }, "Error loading messages from database");
      return [];
    }
  }

  /**
   * Save a message to database
   */
  async saveMessage(message: Message): Promise<void> {
    try {
      logger.info({ role: message.role, chatId: message.chatId }, "Saving message to database");

      // Get next sequence number for this entity/chat combination
      const maxSequenceResult = await db
        .select({ maxSeq: sql<number>`coalesce(max(${entityContext.sequence}), 0)` })
        .from(entityContext)
        .where(
          message.chatId
            ? and(
                eq(entityContext.entityId, OPUS_ENTITY_ID),
                eq(entityContext.chatId, message.chatId),
              )
            : eq(entityContext.entityId, OPUS_ENTITY_ID),
        );

      const nextSequence = (maxSequenceResult[0]?.maxSeq || 0) + 1;

      // Prepare the database record
      const dbRecord: any = {
        entityId: OPUS_ENTITY_ID,
        role: message.role,
        sequence: nextSequence,
        chatId: message.chatId || null,
      };

      // Handle different content types
      if (typeof message.content === "string") {
        dbRecord.content = message.content;
        dbRecord.contextType = "MESSAGE";
      } else if (typeof message.content === "object" && message.content !== null) {
        if ("type" in message.content && message.content.type === "tool_use") {
          const toolCall = message.content as ToolCall;
          dbRecord.content = `Tool call: ${toolCall.name}`;
          dbRecord.contextType = "TOOL_USE";
          dbRecord.toolName = toolCall.name;
          dbRecord.toolId = toolCall.id;
          dbRecord.toolUseId = toolCall.tool_use_id;
          dbRecord.toolInput = toolCall.input;
        } else if ("type" in message.content && message.content.type === "tool_result") {
          const toolResult = message.content as ToolCallResult;
          dbRecord.content = `Tool result: ${JSON.stringify(toolResult.data).substring(0, 100)}`;
          dbRecord.contextType = "TOOL_RESULT";
          dbRecord.toolUseId = toolResult.tool_use_id;
          dbRecord.toolResultData = toolResult.data;
        } else {
          // Fallback for other object types
          dbRecord.content = JSON.stringify(message.content);
          dbRecord.contextType = "MESSAGE";
        }
      }

      // Insert into database
      await db.insert(entityContext).values(dbRecord);

      logger.info(
        { role: message.role, chatId: message.chatId, sequence: nextSequence },
        "Message saved to database",
      );
    } catch (error) {
      logger.error(
        { error, role: message.role, chatId: message.chatId },
        "Error saving message to database",
      );
      throw error;
    }
  }

  /**
   * Prepare messages for LLM processing
   */
  async prepareMessages(messages: Message[], projectId: string, authToken?: string) {
    return prepLLMMessages(messages, projectId, authToken);
  }

  /**
   * Process LangChain stream response
   */
  async processStream(params: {
    stream: AsyncIterable<any>;
    writer: WritableStreamDefaultWriter;
    encoder: TextEncoder;
    generateToolUseId: () => Promise<string>;
    clearToolUseId: () => Promise<void>;
    saveMessages: (message: Message) => Promise<void>;
    projectId: string;
    userId: string;
    state: any;
    authToken?: string;
  }): Promise<string> {
    return processLangChainStream(params);
  }

  /**
   * Generate an AI response using Claude Sonnet
   */
  async generateAIResponse(
    messages: Message[],
    projectId = "infinite-bazaar-demo",
    userId = "user_default",
    authToken?: string,
  ): Promise<{
    textContent: string;
    newMessages: Message[];
  }> {
    return generateResponse(messages, projectId, userId, authToken);
  }

  /**
   * Generate a streaming AI response
   */
  async generateStreamingAIResponse(
    messages: Message[],
    writer: WritableStreamDefaultWriter,
    encoder: TextEncoder,
    projectId = "infinite-bazaar-demo",
    userId = "user_default",
    authToken?: string,
  ): Promise<string> {
    return generateStreamingResponse(messages, projectId, userId, writer, encoder, authToken);
  }

  /**
   * Reset conversation history in database
   */
  async resetConversation(chatId?: string): Promise<void> {
    try {
      logger.info({ chatId, entityId: OPUS_ENTITY_ID }, "Resetting conversation in database");

      // Build delete conditions
      const conditions = [eq(entityContext.entityId, OPUS_ENTITY_ID)];
      if (chatId) {
        conditions.push(eq(entityContext.chatId, chatId));
      }

      // Delete messages from database
      const deleteResult = await db.delete(entityContext).where(and(...conditions));

      logger.info({ chatId, entityId: OPUS_ENTITY_ID }, "Conversation reset in database");
    } catch (error) {
      logger.error({ error, chatId }, "Error resetting conversation in database");
      throw error;
    }
  }

  /**
   * Generate a unique tool use ID
   */
  async generateToolUseId(): Promise<string> {
    return `tool_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Clear tool use ID (placeholder for state management)
   */
  async clearToolUseId(): Promise<void> {
    // Placeholder - in real implementation this would clear from state
    logger.debug("Tool use ID cleared");
  }
}

// Export singleton instance
export const opusService = new OpusService();
