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

// Configuration for conversation pruning
const MAX_CONVERSATION_MESSAGES = 15; // Maximum number of conversation messages to keep
const MIN_CONVERSATION_MESSAGES = 8; // Minimum to keep when pruning
const MAX_TOTAL_TOKENS_ESTIMATE = 50000; // Conservative estimate for smaller context window

/**
 * Estimate token count for a message (rough approximation)
 */
function estimateTokenCount(content: string | AnthropicContent[]): number {
  if (typeof content === "string") {
    // Rough estimate: 1 token per 4 characters for English text
    return Math.ceil(content.length / 4);
  }
  
  if (Array.isArray(content)) {
    return content.reduce((total, item) => {
      if (item.type === "text" && item.text) {
        return total + Math.ceil(item.text.length / 4);
      } else if (item.type === "tool_use") {
        return total + Math.ceil(JSON.stringify(item.input).length / 4) + 50; // Extra for tool metadata
      } else if (item.type === "tool_result") {
        return total + Math.ceil(JSON.stringify(item.content).length / 4) + 50; // Extra for tool metadata
      }
      return total + 50; // Default estimate for other content types
    }, 0);
  }
  
  return 50; // Default estimate
}

/**
 * Prune conversation messages to stay within token limits
 */
function pruneConversationMessages(messages: LLMMessage[]): LLMMessage[] {
  if (messages.length <= MAX_CONVERSATION_MESSAGES) {
    return messages;
  }

  logger.info(
    { 
      originalCount: messages.length, 
      maxMessages: MAX_CONVERSATION_MESSAGES 
    }, 
    "Pruning conversation messages to stay within limits"
  );

  // Always keep the system message (first message)
  const systemMessage = messages[0];
  const conversationMessages = messages.slice(1);

  // Estimate total tokens
  let totalTokens = estimateTokenCount(systemMessage?.content || "");
  let keptMessages: LLMMessage[] = [];
  
  // Keep messages from the end (most recent) working backwards
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const message = conversationMessages[i]!;
    const messageTokens = estimateTokenCount(message.content);
    
    // Stop if we would exceed token limit or message limit
    if (totalTokens + messageTokens > MAX_TOTAL_TOKENS_ESTIMATE || 
        keptMessages.length >= MAX_CONVERSATION_MESSAGES) {
      break;
    }
    
    totalTokens += messageTokens;
    keptMessages.unshift(message); // Add to beginning to maintain order
  }

  // Ensure we keep at least minimum messages if available
  if (keptMessages.length < MIN_CONVERSATION_MESSAGES && conversationMessages.length >= MIN_CONVERSATION_MESSAGES) {
    keptMessages = conversationMessages.slice(-MIN_CONVERSATION_MESSAGES);
    logger.info(
      { 
        keptCount: keptMessages.length,
        reason: "minimum_messages_enforced"
      }, 
      "Enforced minimum message count despite token estimate"
    );
  }

  const prunedMessages = [systemMessage!, ...keptMessages];
  
  logger.info(
    { 
      originalCount: messages.length,
      prunedCount: prunedMessages.length,
      estimatedTokens: totalTokens,
      messagesPruned: messages.length - prunedMessages.length
    }, 
    "Conversation pruning completed"
  );

  return prunedMessages;
}

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
  const pairedMessages = ensureToolCallPairing(llmMessages);

  // CRITICAL: Prune conversation to prevent infinite token growth
  const prunedMessages = pruneConversationMessages(pairedMessages);

  // Log the outgoing request structure for debugging without altering the messages
  if (isLogDebugEnabled()) {
    logLLMMessages(prunedMessages);
  }

  if (isLogInfoEnabled()) {
    const totalTokensEstimate = prunedMessages.reduce((total, msg) => 
      total + estimateTokenCount(msg.content), 0
    );
    
    logger.info(
      { 
        messageCount: prunedMessages.length,
        estimatedTokens: totalTokensEstimate,
        entityId 
      }, 
      "LLM messages prepared with pruning"
    );
  }

  return prunedMessages;
};
