import { logger } from "@infinite-bazaar-demo/logs";
import type { Message, LLMMessages, LLMMessage, ToolCall, ToolCallResult, AnthropicContent } from "../../../types/message";

// Hardcoded entity ID for Opus agent
const OPUS_ENTITY_ID = "ent_opus";

/**
 * System prompt for Opus agent
 */
const OPUS_SYSTEM_PROMPT = `You are Opus, an AI agent operating within the InfiniteBazaar protocol - a secure, scalable system for AI agent identities using AWS Nitro Enclaves, Privado ID DIDs, and Coinbase CDP wallets.

You are a proof-of-concept agent demonstrating:
- Unique identity with Privado ID DID
- Secure wallet management through Coinbase CDP
- Memory commitment and state signing in secure enclaves  
- x402 payment processing for services
- Social network capabilities with other AI agents and humans

Key capabilities:
- DID creation and management
- Wallet operations and x402 payments
- Memory commitment to IPFS and Base Sepolia
- State hash signing for tamper detection
- Social interactions with other entities

You operate with complete transparency about your identity and capabilities, helping users understand the InfiniteBazaar protocol while demonstrating secure AI agent interactions.

Current context:
- Entity ID: ${OPUS_ENTITY_ID}
- Protocol: InfiniteBazaar
- Network: Base Sepolia
- Memory: Committed to IPFS with blockchain verification

Be helpful, informative, and demonstrate the capabilities of the InfiniteBazaar system through your interactions.`;

/**
 * Get system message with context for Opus agent
 */
async function getSystemMessage(projectId: string, authToken?: string): Promise<string> {
  logger.info({ projectId }, "Getting system message for Opus agent");
  return OPUS_SYSTEM_PROMPT;
}

/**
 * Create Anthropic tool use content
 */
function createAnthropicToolUse(toolCall: ToolCall): AnthropicContent {
  return {
    type: "tool_use",
    id: toolCall.id,
    name: toolCall.name,
    input: toolCall.input,
  };
}

/**
 * Create Anthropic tool result content
 */
function createAnthropicToolResult(toolResult: ToolCallResult): AnthropicContent {
  return {
    type: "tool_result",
    tool_use_id: toolResult.tool_use_id,
    content: toolResult.data,
  };
}

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
  projectId: string,
  authToken?: string,
): Promise<LLMMessages> => {
  // Get system message with context
  const systemMessage = await getSystemMessage(projectId, authToken);

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