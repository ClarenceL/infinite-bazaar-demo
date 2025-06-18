import { logger } from "@infinite-bazaar-demo/logs";
import { ChatAnthropic } from "@langchain/anthropic";
import { prepLLMMessages, processLangChainStream } from "../../agents/opus/utils";
import { streamingDBSync } from "../../services/streaming-db-sync.js";
import type { Message } from "../../types/message";

// Import MCP tools (placeholder for now - will be implemented later)
const mcpTools: any[] = [
  // Tools will be added here when MCP integration is complete
];

/**
 * Generate a response using Claude Sonnet via LangChain
 */
export async function generateResponse(
  messages: Message[],
  projectId: string,
  userId: string,
  authToken?: string,
): Promise<{
  textContent: string;
  newMessages: Message[];
}> {
  logger.info({ messageCount: messages.length, projectId, userId }, "Generating LLM response");

  const newMessages: Message[] = [];
  let textContent = "";

  try {
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
    const llmMessages = await prepLLMMessages(messages, projectId, authToken);
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
      projectId,
      userId,
      state: {}, // Mock state object
      authToken,
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
    logger.error({ error }, "Error generating LLM response");

    // Handle specific error types
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for overloaded error
    const isOverloadedError =
      (error instanceof Error &&
        (errorMessage.includes("overloaded") || errorMessage.includes("Overloaded"))) ||
      (error instanceof Error &&
        "cause" in error &&
        error.cause instanceof Error &&
        ((error.cause as Error).message.includes("overloaded") ||
          (error.cause as Error).message.includes("Overloaded")));

    // Create appropriate fallback response
    let fallbackResponse: string;
    if (isOverloadedError) {
      fallbackResponse =
        "I'm experiencing high demand right now. Please try again in a moment. In the meantime, I'm Opus, your AI agent in the InfiniteBazaar protocol, ready to help you understand secure AI agent identities, DIDs, and blockchain technology.";
    } else if (errorMessage.includes("ANTHROPIC_API_KEY")) {
      fallbackResponse =
        "I'm currently in development mode. I'm Opus, your AI agent in the InfiniteBazaar protocol. I can help you understand how secure AI agent identities work with DIDs, CDP wallets, and Nitro Enclaves, though my responses are currently simulated.";
    } else {
      fallbackResponse =
        "I encountered an issue processing your request. I'm Opus, your AI agent in the InfiniteBazaar protocol. Let me try to help you with information about secure AI agent identities and the InfiniteBazaar system.";
    }

    // Add error context to the response if helpful
    logger.warn({ fallbackResponse }, "Using fallback response due to LLM error");

    return {
      textContent: fallbackResponse,
      newMessages: [],
    };
  }
}

/**
 * Generate a streaming response (for future use with SSE endpoints)
 */
export async function generateStreamingResponse(
  messages: Message[],
  projectId: string,
  userId: string,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  authToken?: string,
): Promise<string> {
  logger.info(
    { messageCount: messages.length, projectId, userId },
    "Generating streaming LLM response",
  );

  try {
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
      model: "claude-sonnet-4-20250514",
      temperature: 1.0,
      clientOptions: {
        defaultHeaders: {
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
      },
    }).bindTools(mcpTools);

    // Prepare messages for LLM
    const llmMessages = await prepLLMMessages(messages, projectId, authToken);

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
        projectId,
        userId,
        state: {}, // Mock state object
        authToken,
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

    return textContent;
  } catch (error) {
    logger.error({ error }, "Error generating streaming LLM response");

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isOverloadedError =
      (error instanceof Error &&
        (errorMessage.includes("overloaded") || errorMessage.includes("Overloaded"))) ||
      (error instanceof Error &&
        "cause" in error &&
        error.cause instanceof Error &&
        ((error.cause as Error).message.includes("overloaded") ||
          (error.cause as Error).message.includes("Overloaded")));

    // Send error to stream
    let userErrorMessage: string;
    if (isOverloadedError) {
      userErrorMessage =
        "The AI service is currently overloaded. Please try again in a few moments.";
    } else if (errorMessage.includes("ANTHROPIC_API_KEY")) {
      userErrorMessage = "AI service is not configured. Running in development mode.";
    } else {
      userErrorMessage = `Error: ${errorMessage}`;
    }

    logger.error({ userErrorMessage }, "Sending error message to stream");
    await writer.write(encoder.encode(`0:${JSON.stringify(userErrorMessage)}\n\n`));
    return userErrorMessage;
  }
}
