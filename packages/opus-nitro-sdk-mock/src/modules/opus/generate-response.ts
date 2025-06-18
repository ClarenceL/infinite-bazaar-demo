import { logger } from "@infinite-bazaar-demo/logs";
import { ChatAnthropic } from "@langchain/anthropic";
import { prepLLMMessages, processLangChainStream } from "../../agents/opus/utils";
import { getSystemMessage } from "../../agents/opus/utils/systemMessage.js";
import { processToolCall } from "../../agents/tools/handlers/index.js";
import { streamingDBSync } from "../../services/streaming-db-sync.js";
import type { Message } from "../../types/message";

// Import MCP tools (placeholder for now - will be implemented later)
const mcpTools: any[] = [
  // Tools will be added here when MCP integration is complete
];

/**
 * Generate a response using Claude via LangChain
 */
export async function generateResponse(messages: Message[]): Promise<{
  textContent: string;
  newMessages: Message[];
}> {
  logger.info({ messageCount: messages.length }, "Generating LLM response");

  const newMessages: Message[] = [];
  let textContent = "";

  try {
    // Get system message
    const systemMessage = await getSystemMessage();

    // Check for required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }

    // Initialize ChatAnthropic with tools
    const llm = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: "claude-sonnet-4-20250514",
      temperature: 1.0,
      clientOptions: {
        defaultHeaders: {
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
      },
    }).bindTools(mcpTools);

    // Prepare messages for LLM
    const llmMessages = await prepLLMMessages(messages);
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
      { messages: JSON.stringify(llmMessages, null, 2) },
      "LLM Messages being sent to Anthropic",
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
): Promise<void> {
  logger.info({ messageCount: messages.length }, "Generating streaming LLM response");

  try {
    // Get system message
    const systemMessage = await getSystemMessage();

    // Check for required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      const errorMsg = "ANTHROPIC_API_KEY environment variable is required";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    logger.info("ANTHROPIC_API_KEY is available, proceeding with LLM call");

    // Initialize ChatAnthropic with tools
    const llm = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // model: "claude-sonnet-4-20250514",
      model: "claude-opus-4-20250514",
      temperature: 1.0,
      clientOptions: {
        defaultHeaders: {
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
      },
    }).bindTools(mcpTools);

    // Prepare messages for LLM
    const llmMessages = await prepLLMMessages(messages);

    logger.info(
      {
        llmMessageCount: llmMessages.length,
      },
      "Prepared messages for LLM - streaming version",
    );

    // Log the actual messages being sent (for debugging)
    logger.info(
      { messages: JSON.stringify(llmMessages, null, 2) },
      "LLM Messages being sent to Anthropic",
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
      const { opusService } = await import("./opus.service.js");
      await opusService.saveMessage(message);
    };

    // Create initial streaming record if real-time sync is enabled
    let streamingContextId: string | undefined;
    if (streamingDBSync.isEnabled()) {
      // Get next sequence number for the assistant response
      const { opusService } = await import("./opus.service.js");
      const existingMessages = await opusService.loadMessages();
      const nextSequence = existingMessages.length + 1;

      const contextId = await streamingDBSync.createInitialRecord({
        entityId: "ent_opus", // Hardcoded for now
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
      const { opusService } = await import("./opus.service.js");
      await opusService.saveMessage({
        role: "assistant",
        content: textContent,
        timestamp: Date.now(),
      });
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
