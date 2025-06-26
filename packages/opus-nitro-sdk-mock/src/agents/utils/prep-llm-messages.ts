import { logger } from "@infinite-bazaar-demo/logs";
import type {
  AnthropicContent,
  LLMMessage,
  LLMMessages,
  Message,
  ToolCall,
  ToolCallResult,
} from "../../types/message";
import { createAnthropicToolResult, createAnthropicToolUse } from "../../types/message";

import { getSystemMessage } from "./system-message";

/**
 * Guard function to ensure that every tool_use has a corresponding tool_result with matching tool_use_id
 * Removes unpaired tool_use calls and their following tool_result if it exists
 */
function ensureToolCallPairing(messages: LLMMessage[]): LLMMessage[] {
  const cleanedMessages: LLMMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const currentMsg = messages[i];

    // Skip if currentMsg is undefined (shouldn't happen with proper array access)
    if (!currentMsg) {
      continue;
    }

    // Check if current message contains tool_use
    if (
      Array.isArray(currentMsg.content) &&
      currentMsg.content.length > 0 &&
      currentMsg.content[0]?.type === "tool_use"
    ) {
      const toolUseId = currentMsg.content[0].id;
      const nextMsg = messages[i + 1];

      // Check if next message is a matching tool_result
      if (
        nextMsg &&
        Array.isArray(nextMsg.content) &&
        nextMsg.content.length > 0 &&
        nextMsg.content[0]?.type === "tool_result" &&
        nextMsg.content[0].tool_use_id === toolUseId
      ) {
        // Valid pair - add both messages
        cleanedMessages.push(currentMsg);
        cleanedMessages.push(nextMsg);
        i++; // Skip the next message since we already processed it
      } else {
        // Unpaired tool_use - remove it
        // Also remove the next message if it's a tool_result (but not if it's a normal message)
        if (
          nextMsg &&
          Array.isArray(nextMsg.content) &&
          nextMsg.content.length > 0 &&
          nextMsg.content[0]?.type === "tool_result"
        ) {
          i++; // Skip the next message (tool_result) as well
        }
        // Don't add the current tool_use message to cleanedMessages
      }
    } else {
      // Not a tool_use message - add it normally
      cleanedMessages.push(currentMsg);
    }
  }

  return cleanedMessages;
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
