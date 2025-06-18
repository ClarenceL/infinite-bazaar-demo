import { ChatAnthropic } from "@langchain/anthropic";
import { logger } from "@infinite-bazaar-demo/logs";
import { prepLLMMessages, processLangChainStream } from "../../agents/opus/utils";
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
    const stream = await llm.stream(llmMessages);

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

    logger.info({ textLength: textContent.length, newMessageCount: newMessages.length }, "LLM response generated");

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
      fallbackResponse = "I'm experiencing high demand right now. Please try again in a moment. In the meantime, I'm Opus, your AI agent in the InfiniteBazaar protocol, ready to help you understand secure AI agent identities, DIDs, and blockchain technology.";
    } else if (errorMessage.includes("ANTHROPIC_API_KEY")) {
      fallbackResponse = "I'm currently in development mode. I'm Opus, your AI agent in the InfiniteBazaar protocol. I can help you understand how secure AI agent identities work with DIDs, CDP wallets, and Nitro Enclaves, though my responses are currently simulated.";
    } else {
      fallbackResponse = "I encountered an issue processing your request. I'm Opus, your AI agent in the InfiniteBazaar protocol. Let me try to help you with information about secure AI agent identities and the InfiniteBazaar system.";
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
  logger.info({ messageCount: messages.length, projectId, userId }, "Generating streaming LLM response");

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

    // Generate tool use ID counter
    let toolUseIdCounter = 0;
    const generateToolUseId = async (): Promise<string> => {
      return `tool_${Date.now()}_${++toolUseIdCounter}`;
    };

    const clearToolUseId = async (): Promise<void> => {
      // No-op for now
    };

    const saveMessages = async (message: Message): Promise<void> => {
      // Messages will be saved by the calling service
      logger.debug({ role: message.role }, "Message ready for saving");
    };

    // Start streaming call to Anthropic
    logger.info("Starting streaming call to Anthropic");
    const stream = await llm.stream(llmMessages);

    // Process the stream with real writer
    const textContent = await processLangChainStream({
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
    });

    logger.info({ textLength: textContent.length }, "Streaming response completed");
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
      userErrorMessage = "The AI service is currently overloaded. Please try again in a few moments.";
    } else if (errorMessage.includes("ANTHROPIC_API_KEY")) {
      userErrorMessage = "AI service is not configured. Running in development mode.";
    } else {
      userErrorMessage = `Error: ${errorMessage}`;
    }

    await writer.write(encoder.encode(`0:${JSON.stringify(userErrorMessage)}\n\n`));
    return userErrorMessage;
  }
} 