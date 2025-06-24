import { logger } from "@infinite-bazaar-demo/logs";
import { ChatAnthropic } from "@langchain/anthropic";
import { mcpTools } from "../../agents/tools/index";
import { getAnthropicModelForEntity } from "../../agents/prompts/index";
import { prepLLMMessages, processLangChainStream } from "../../agents/utils";
import { streamingDBSync } from "../../services/streaming-db-sync";
import type { Message } from "../../types/message";

/**
 * Generate a response using Claude via LangChain
 */
export async function generateResponse(
  messages: Message[],
  entityId: string,
): Promise<{
  textContent: string;
  newMessages: Message[];
}> {
  logger.info({ messageCount: messages.length, entityId }, "Generating LLM response");

  const newMessages: Message[] = [];
  let textContent = "";

  try {
    // Check for required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }

    // Get the anthropic model for this entity from database
    const anthropicModel = await getAnthropicModelForEntity(entityId);
    const modelToUse = anthropicModel || "claude-opus-4-20250514"; // fallback to default

    logger.info({ entityId, anthropicModel, modelToUse }, "Using anthropic model for entity");

    // Initialize ChatAnthropic with tools
    const llm = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: modelToUse,
      temperature: 1.0,
      clientOptions: {
        defaultHeaders: {
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
      },
    }).bindTools(mcpTools);

    // Prepare messages for LLM
    const llmMessages = await prepLLMMessages(messages, entityId);
    logger.info({ llmMessageCount: llmMessages.length }, "Prepared messages for LLM");

    // Create a mock stream writer for processing
    const chunks: string[] = [];
    const mockWriter = {
      write: async (chunk: Uint8Array) => {
        const text = new TextDecoder().decode(chunk);
        chunks.push(text);
      },
      close: async () => {
        // No-op for mock writer
      },
    };

    const encoder = new TextEncoder();

    // Log the actual messages being sent (for debugging)
    logger.info(
      {
        llmMessageCount: llmMessages.length,
        systemMessageLength:
          typeof llmMessages[0]?.content === "string" ? llmMessages[0].content.length : 0,
        messageRoles: llmMessages.map((m) => m.role),
        totalContentLength: llmMessages.reduce((acc, msg) => {
          if (typeof msg.content === "string") return acc + msg.content.length;
          if (Array.isArray(msg.content)) return acc + JSON.stringify(msg.content).length;
          return acc;
        }, 0),
      },
      "LLM Messages summary for Anthropic",
    );

    // Generate tool use ID counter
    let toolUseIdCounter = 0;
    const generateToolUseId = async (): Promise<string> => {
      return `tool_${Date.now()}_${++toolUseIdCounter}`;
    };

    const clearToolUseId = async (): Promise<void> => {
      // No-op for now
    };

    const saveMessages = async (message: Message): Promise<void> => {
      newMessages.push(message);
    };

    // Start streaming call to Anthropic
    logger.info("Starting stream call to Anthropic");
    const stream = await llm.stream(llmMessages as any); // Cast to bypass type issues

    logger.info("LLM stream created, starting processLangChainStream");

    // Process the stream
    textContent = await processLangChainStream({
      stream,
      writer: mockWriter as any,
      encoder,
      generateToolUseId,
      clearToolUseId,
      saveMessages,
      state: {}, // Mock state object
      entityId,
    });

    logger.info(
      { textLength: textContent.length, textPreview: textContent.substring(0, 200) },
      "processLangChainStream completed",
    );

    return {
      textContent,
      newMessages,
    };
  } catch (error) {
    logger.error({ error }, "Error generating response");
    throw error;
  }
}

/**
 * Generate a streaming response (for future use with SSE endpoints)
 */
export async function generateStreamingResponse(
  messages: Message[],
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  entityId: string,
): Promise<void> {
  logger.info({ messageCount: messages.length }, "Generating streaming LLM response");

  try {
    // Check for required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      const errorMsg = "ANTHROPIC_API_KEY environment variable is required";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    logger.info("ANTHROPIC_API_KEY is available, proceeding with LLM call");

    // Get the anthropic model for this entity from database
    const anthropicModel = await getAnthropicModelForEntity(entityId);
    const modelToUse = anthropicModel || "claude-opus-4-20250514"; // fallback to default

    logger.info({ entityId, anthropicModel, modelToUse }, "Using anthropic model for entity (streaming)");

    // Initialize ChatAnthropic with tools
    const llm = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: modelToUse,
      temperature: 1.0,
      clientOptions: {
        defaultHeaders: {
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
      },
    }).bindTools(mcpTools);

    // Prepare messages for LLM
    const llmMessages = await prepLLMMessages(messages, entityId);

    logger.info(
      {
        llmMessageCount: llmMessages.length,
      },
      "Prepared messages for LLM - streaming version",
    );

    // Log the actual messages being sent (for debugging)
    logger.info(
      {
        llmMessageCount: llmMessages.length,
        systemMessageLength:
          typeof llmMessages[0]?.content === "string" ? llmMessages[0].content.length : 0,
        messageRoles: llmMessages.map((m) => m.role),
        totalContentLength: llmMessages.reduce((acc, msg) => {
          if (typeof msg.content === "string") return acc + msg.content.length;
          if (Array.isArray(msg.content)) return acc + JSON.stringify(msg.content).length;
          return acc;
        }, 0),
      },
      "LLM Messages summary for Anthropic - streaming",
    );

    // Generate tool use ID counter
    let toolUseIdCounter = 0;
    const generateToolUseId = async (): Promise<string> => {
      return `tool_${Date.now()}_${++toolUseIdCounter}`;
    };

    const clearToolUseId = async (): Promise<void> => {
      // No-op for now
    };

    const saveMessages = async (message: Message): Promise<void> => {
      // This callback is used during streaming for tool calls
      // The complete response will be saved after streaming completes
      logger.debug({ role: message.role }, "Tool call/result message ready for saving");
      const { agentService } = await import("./agent.service.js");
      await agentService.saveMessage(message, entityId);
    };

    // Create initial streaming record if real-time sync is enabled
    let streamingContextId: string | undefined;
    if (streamingDBSync.isEnabled()) {
      // Get next sequence number for the assistant response using proper database query
      // Import required database utilities
      const { db, entityContext, eq, and, sql } = await import("@infinite-bazaar-demo/db");

      const actualEntityId = entityId || "ent_opus";
      const maxSequenceResult = await db
        .select({ maxSeq: sql<number>`coalesce(max(${entityContext.sequence}), 0)` })
        .from(entityContext)
        .where(eq(entityContext.entityId, actualEntityId));

      const nextSequence = (maxSequenceResult[0]?.maxSeq || 0) + 1;

      const contextId = await streamingDBSync.createInitialRecord({
        entityId: entityId || "ent_opus",
        role: "assistant",
        sequence: nextSequence,
      });
      streamingContextId = contextId || undefined;
    }

    // Start streaming call to Anthropic
    logger.info("Starting streaming call to Anthropic");
    const stream = await llm.stream(llmMessages as any); // Cast to bypass type issues

    logger.info("LLM stream created, starting processLangChainStream");

    // Process the stream with real writer
    let textContent: string;
    try {
      textContent = await processLangChainStream({
        stream,
        writer,
        encoder,
        generateToolUseId,
        clearToolUseId,
        saveMessages,
        state: {}, // Mock state object
        streamingContextId,
        entityId,
      });
      logger.info(
        { textLength: textContent.length, textPreview: textContent.substring(0, 200) },
        "processLangChainStream completed",
      );
    } catch (error) {
      logger.error(error, "Error in processLangChainStream");
      textContent = "Error processing stream";
      // Still send done signal even on error
      writer.write(encoder.encode(`data: {"type":"done"}\n\n`));
    }

    // Save the complete response if we have text content and real-time sync is not enabled
    if (textContent && !streamingDBSync.isEnabled()) {
      logger.info("Saving complete assistant response to database");
      const { agentService } = await import("./agent.service.js");
      await agentService.saveMessage(
        {
          role: "assistant",
          content: textContent,
          timestamp: Date.now(),
        },
        entityId,
      );
    } else if (streamingDBSync.isEnabled()) {
      logger.info("Real-time sync enabled - response already saved incrementally");
    }
  } catch (error) {
    logger.error({ error }, "Error in streaming response");
    // Send error to client
    const errorData = JSON.stringify({ error: "Internal server error" });
    await writer.write(encoder.encode(`error:${errorData}\n`));
    throw error;
  }
}
