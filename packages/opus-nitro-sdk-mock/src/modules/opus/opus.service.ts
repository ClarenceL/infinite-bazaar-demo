import { logger } from "@infinite-bazaar-demo/logs";
import { prepLLMMessages, processLangChainStream } from "../../agents/opus/utils";
import type { Message, ChatMessage, ChatRequest, OpusInfo } from "../../types/message";

// Hardcoded entity ID for Opus agent
const OPUS_ENTITY_ID = "ent_opus";

// In-memory message storage for now (will be replaced with database later)
const messageHistory: Message[] = [];

export class OpusService {
  /**
   * Get Opus agent information
   */
  async getOpusInfo(): Promise<OpusInfo> {
    logger.info("Getting Opus agent information");

    return {
      entityId: OPUS_ENTITY_ID,
      systemPrompt: "Opus AI agent for InfiniteBazaar protocol demonstration",
      messageCount: messageHistory.length,
      status: "active",
      capabilities: [
        "DID creation and management",
        "Wallet operations and x402 payments",
        "Memory commitment to IPFS and Base Sepolia",
        "State hash signing for tamper detection",
        "Social interactions with other entities"
      ]
    };
  }



  /**
   * Load message history for the agent
   */
  async loadMessages(chatId?: string): Promise<Message[]> {
    try {
      logger.info({ chatId }, "Loading message history");
      return messageHistory.filter(msg => !chatId || msg.chatId === chatId);
    } catch (error) {
      logger.error({ error }, "Error loading messages");
      return [];
    }
  }

  /**
   * Save a message to storage
   */
  async saveMessage(message: Message): Promise<void> {
    try {
      const messageWithTimestamp: Message = {
        ...message,
        timestamp: message.timestamp || Date.now(),
      };

      messageHistory.push(messageWithTimestamp);
      logger.info({ role: message.role, chatId: message.chatId }, "Message saved");
    } catch (error) {
      logger.error({ error }, "Error saving message");
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
   * Generate a mock AI response (will be replaced with actual LLM later)
   */
  async generateResponse(message: string, history: Message[]): Promise<string> {
    logger.info({ messageLength: message.length, historyLength: history.length }, "Generating response");

    // Mock response for now
    const responses = [
      `Hello! I'm Opus, your AI agent in the InfiniteBazaar protocol. You said: "${message}". I'm here to help you understand how secure AI agent identities work with DIDs, CDP wallets, and Nitro Enclaves.`,
      `As an AI agent with a unique Privado ID DID, I can help you explore the capabilities of the InfiniteBazaar system. Your message "${message}" is interesting! Would you like to learn about DID creation, wallet management, or memory commitment?`,
      `Thanks for your message: "${message}". I'm demonstrating how AI agents can have secure, verifiable identities using AWS Nitro Enclaves and blockchain technology. What aspect of the InfiniteBazaar protocol interests you most?`,
    ];

    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex] ?? responses[0] ?? "I'm Opus, your AI agent in the InfiniteBazaar protocol. How can I help you today?";
  }

  /**
   * Reset conversation history
   */
  async resetConversation(chatId?: string): Promise<void> {
    try {
      logger.info({ chatId }, "Resetting conversation");

      if (chatId) {
        // Remove messages for specific chat
        const indexesToRemove = [];
        for (let i = messageHistory.length - 1; i >= 0; i--) {
          const message = messageHistory[i];
          if (message && message.chatId === chatId) {
            indexesToRemove.push(i);
          }
        }
        for (const index of indexesToRemove) {
          messageHistory.splice(index, 1);
        }
      } else {
        // Clear all messages
        messageHistory.length = 0;
      }

      logger.info({ chatId, remainingMessages: messageHistory.length }, "Conversation reset");
    } catch (error) {
      logger.error({ error }, "Error resetting conversation");
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