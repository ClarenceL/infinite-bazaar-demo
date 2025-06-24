import { logger } from "@infinite-bazaar-demo/logs";
import type {
  AnthropicContent,
  LLMMessage,
  LLMMessages,
  Message,
  ToolCall,
  ToolCallResult,
} from "../../../types/message";
import { createAnthropicToolResult, createAnthropicToolUse } from "../../../types/message";

import { getSystemMessage } from "./system-message";

/**
 * Ensure proper tool call pairing in LLM messages
 */
function ensureToolCallPairing(messages: LLMMessage[]): LLMMessage[] {
  // For now, just return the messages as-is
  // In a full implementation, this would ensure tool_use messages are properly paired with tool_result messages
  return messages;
}

/**
 * Check if debug logging is enabled
 */
function isLogDebugEnabled(): boolean {
  return process.env.LOG_LEVEL === "debug";
}

/**
 * Check if info logging is enabled
 */
function isLogInfoEnabled(): boolean {
  return process.env.LOG_LEVEL === "info" || process.env.LOG_LEVEL === "debug";
}

/**
 * Log LLM messages for debugging
 */
function logLLMMessages(messages: LLMMessage[]): void {
  logger.debug({ messageCount: messages.length }, "LLM messages prepared");
  for (const msg of messages) {
    logger.debug({ role: msg.role, contentType: typeof msg.content }, "LLM message");
  }
}

/**
 * Prepare messages for LLM processing following Lyra MCP server pattern
 */
export const prepLLMMessages = async (
  messages: Message[],
  entityId: string,
): Promise<LLMMessages> => {
  // Get system message with context and entityId
  const systemMessage = await getSystemMessage(entityId);

  // Prepare message history for the LLM
  // First add the system message
  const llmMessages: LLMMessages = [
    {
      role: "system",
      content: systemMessage,
      cache_control: { type: "ephemeral" },
    },
  ];

  // Use all messages, no limit
  // Note: We're assuming messages are already in chronological order
  // If they're not, we should sort them by timestamp if available

  // Transform each message to the correct Anthropic format
  for (const msg of messages) {
    // Skip messages with empty content (Anthropic rejects them)
    if (typeof msg.content === "string" && msg.content.trim() === "") {
      logger.debug({ role: msg.role }, "Skipping message with empty content");
      continue;
    }

    // Skip messages already in Anthropic format
    if (
      Array.isArray(msg.content) &&
      msg.content.length > 0 &&
      (msg.content[0]?.type === "tool_result" || msg.content[0]?.type === "tool_use")
    ) {
      llmMessages.push({ role: msg.role, content: msg.content });
      continue;
    }

    // Transform the content to the correct format based on type
    if (typeof msg.content === "string") {
      llmMessages.push({ role: msg.role, content: msg.content });
    } else if (typeof msg.content === "object" && msg.content !== null) {
      if ("type" in msg.content && msg.content.type === "tool_use") {
        // Handle ToolCall
        const toolCall = msg.content as ToolCall;
        try {
          const toolUseContent = createAnthropicToolUse(toolCall);
          llmMessages.push({
            role: msg.role,
            content: [toolUseContent],
          });
        } catch (error) {
          logger.warn({ error }, "Failed to create tool use");
          // Skip adding this message to llmMessages
        }
      } else if ("data" in msg.content) {
        // Handle ToolCallResult
        const toolResult = msg.content as ToolCallResult;
        try {
          const toolResultContent = createAnthropicToolResult(toolResult);
          llmMessages.push({
            role: msg.role,
            content: [toolResultContent],
          });
        } catch (error) {
          logger.warn({ error }, "Failed to create tool result");
          // Skip adding this message to llmMessages
        }
      }
    }
  }

  // Ensure proper tool call pairing
  const cleanedLlmMessages = ensureToolCallPairing(llmMessages);

  // Log the outgoing request structure for debugging without altering the messages
  if (isLogDebugEnabled()) {
    logLLMMessages(cleanedLlmMessages);
  }

  if (isLogInfoEnabled()) {
    for (const llmMsg of cleanedLlmMessages) {
      logger.info({ role: llmMsg.role, contentType: typeof llmMsg.content }, "LLM message");
    }
  }

  return cleanedLlmMessages;
};
