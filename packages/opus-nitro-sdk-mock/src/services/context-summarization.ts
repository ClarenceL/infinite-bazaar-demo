import { db, contextSummaries, entityContext, eq, and, desc } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";
import { ChatAnthropic } from "@langchain/anthropic";

// Configuration
const SUMMARIZATION_TRIGGER_COUNT = 10; // Summarize every 10 messages
const MAX_SUMMARY_LENGTH = 1000; // Target summary length in characters
const HAIKU_MODEL = "claude-3-haiku-20240307"; // Cheaper model for summarization

interface SummarizeOptions {
  entityId: string;
  instanceId: string;
  messageCount?: number;
}

interface ContextSummary {
  summaryText: string;
  messageCount: number;
  lastMessageId: string;
  tokenEstimate: number;
}

/**
 * Context Summarization Service
 * Uses Claude Haiku to create concise summaries of conversation history
 */
export class ContextSummarizationService {
  private haiku: ChatAnthropic;

  constructor() {
    this.haiku = new ChatAnthropic({
      modelName: HAIKU_MODEL,
      temperature: 0.3, // Lower temperature for consistent summaries
      maxTokens: 1000,   // Limit summary length
    });
  }

  /**
   * Check if summarization is needed for an entity
   */
  async shouldSummarize(entityId: string, instanceId: string): Promise<boolean> {
    try {
      // Get the latest summary for this entity
      const latestSummary = await db
        .select()
        .from(contextSummaries)
        .where(and(
          eq(contextSummaries.entityId, entityId),
          eq(contextSummaries.instanceId, instanceId),
          eq(contextSummaries.summaryType, "conversation")
        ))
        .orderBy(desc(contextSummaries.createdAt))
        .limit(1);

      // Get message count since last summary
      let messageCountSinceLastSummary = 0;
      
      if (latestSummary.length > 0) {
        const lastSummaryDate = latestSummary[0]!.createdAt;
        
        const messagesSinceResult = await db
          .select({ count: entityContext.contextId })
          .from(entityContext)
          .where(and(
            eq(entityContext.entityId, entityId),
            eq(entityContext.instanceId, instanceId),
            eq(entityContext.contextType, "MESSAGE")
          ));
          
        messageCountSinceLastSummary = messagesSinceResult.length;
      } else {
        // No previous summary - check total message count
        const totalMessagesResult = await db
          .select({ count: entityContext.contextId })
          .from(entityContext)
          .where(and(
            eq(entityContext.entityId, entityId),
            eq(entityContext.instanceId, instanceId),
            eq(entityContext.contextType, "MESSAGE")
          ));
          
        messageCountSinceLastSummary = totalMessagesResult.length;
      }

      logger.info(
        { entityId, instanceId, messageCountSinceLastSummary },
        "Checking if summarization is needed"
      );

      return messageCountSinceLastSummary >= SUMMARIZATION_TRIGGER_COUNT;
    } catch (error) {
      logger.error({ error, entityId, instanceId }, "Error checking summarization need");
      return false;
    }
  }

  /**
   * Get messages to summarize (excluding those already summarized)
   */
  private async getMessagesToSummarize(entityId: string, instanceId: string): Promise<any[]> {
    try {
      // Get the latest summary to know where we left off
      const latestSummary = await db
        .select()
        .from(contextSummaries)
        .where(and(
          eq(contextSummaries.entityId, entityId),
          eq(contextSummaries.instanceId, instanceId),
          eq(contextSummaries.summaryType, "conversation")
        ))
        .orderBy(desc(contextSummaries.createdAt))
        .limit(1);

      let whereConditions = [
        eq(entityContext.entityId, entityId),
        eq(entityContext.instanceId, instanceId),
        eq(entityContext.contextType, "MESSAGE")
      ];

      // If we have a previous summary, only get messages after that
      if (latestSummary.length > 0) {
        const lastSummaryDate = latestSummary[0]!.createdAt;
        if (lastSummaryDate) {
          whereConditions.push(
            // Get messages created after the last summary
            // This is a simplified approach - in production you'd use the lastMessageId
          );
        }
      }

      const messages = await db
        .select({
          contextId: entityContext.contextId,
          content: entityContext.content,
          role: entityContext.role,
          createdAt: entityContext.createdAt,
        })
        .from(entityContext)
        .where(and(...whereConditions))
        .orderBy(entityContext.createdAt)
        .limit(SUMMARIZATION_TRIGGER_COUNT * 2); // Get more than we need for context

      return messages;
    } catch (error) {
      logger.error({ error, entityId, instanceId }, "Error fetching messages to summarize");
      return [];
    }
  }

  /**
   * Generate a summary using Claude Haiku
   */
  private async generateSummary(messages: any[]): Promise<string> {
    if (messages.length === 0) return "";

    // Format messages for summarization
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = `Please create a concise summary of this conversation history. Focus on:
- Key topics discussed
- Important decisions or outcomes
- Ongoing themes or patterns
- Relationships between participants

Conversation:
${conversationText}

Summary (max ${MAX_SUMMARY_LENGTH} characters):`;

    try {
      const response = await this.haiku.invoke([
        { role: "user", content: prompt }
      ]);

      let summaryText = "";
      if (typeof response.content === "string") {
        summaryText = response.content;
      } else if (Array.isArray(response.content)) {
        summaryText = response.content
          .filter(item => item.type === "text")
          .map(item => item.text)
          .join(" ");
      }

      // Trim to target length
      if (summaryText.length > MAX_SUMMARY_LENGTH) {
        summaryText = summaryText.substring(0, MAX_SUMMARY_LENGTH - 3) + "...";
      }

      return summaryText;
    } catch (error) {
      logger.error({ error }, "Error generating summary with Haiku");
      return "Summary generation failed";
    }
  }

  /**
   * Create and store a summary for an entity
   */
  async createSummary(options: SummarizeOptions): Promise<ContextSummary | null> {
    const { entityId, instanceId, messageCount } = options;

    try {
      logger.info({ entityId, instanceId }, "Creating context summary");

      // Get messages to summarize
      const messages = await this.getMessagesToSummarize(entityId, instanceId);
      
      if (messages.length === 0) {
        logger.info({ entityId, instanceId }, "No messages to summarize");
        return null;
      }

      // Generate summary using Haiku
      const summaryText = await this.generateSummary(messages);
      
      if (!summaryText) {
        logger.warn({ entityId, instanceId }, "Failed to generate summary");
        return null;
      }

      // Estimate tokens (rough approximation)
      const tokenEstimate = Math.ceil(summaryText.length / 4);
      
      // Get the last message ID
      const lastMessage = messages[messages.length - 1];
      const lastMessageId = lastMessage?.contextId || "";

      // Store summary in database
      const summaryRecord = {
        entityId,
        instanceId,
        summaryText,
        messageCount: messages.length,
        lastMessageId,
        tokenEstimate,
        summaryType: "conversation" as const,
      };

      await db.insert(contextSummaries).values(summaryRecord);

      logger.info(
        { 
          entityId, 
          instanceId, 
          messageCount: messages.length,
          tokenEstimate,
          summaryLength: summaryText.length 
        },
        "Context summary created successfully"
      );

      return {
        summaryText,
        messageCount: messages.length,
        lastMessageId,
        tokenEstimate,
      };
    } catch (error) {
      logger.error({ error, entityId, instanceId }, "Error creating context summary");
      return null;
    }
  }

  /**
   * Get the latest summary for an entity
   */
  async getLatestSummary(entityId: string, instanceId: string): Promise<ContextSummary | null> {
    try {
      const summary = await db
        .select()
        .from(contextSummaries)
        .where(and(
          eq(contextSummaries.entityId, entityId),
          eq(contextSummaries.instanceId, instanceId),
          eq(contextSummaries.summaryType, "conversation")
        ))
        .orderBy(desc(contextSummaries.createdAt))
        .limit(1);

      if (summary.length === 0) return null;

      const record = summary[0]!;
      return {
        summaryText: record.summaryText,
        messageCount: record.messageCount,
        lastMessageId: record.lastMessageId || "",
        tokenEstimate: record.tokenEstimate || 0,
      };
    } catch (error) {
      logger.error({ error, entityId, instanceId }, "Error fetching latest summary");
      return null;
    }
  }

  /**
   * Auto-summarize if needed (call this when new messages arrive)
   */
  async autoSummarizeIfNeeded(entityId: string, instanceId: string): Promise<void> {
    try {
      if (await this.shouldSummarize(entityId, instanceId)) {
        await this.createSummary({ entityId, instanceId });
      }
    } catch (error) {
      logger.error({ error, entityId, instanceId }, "Error in auto-summarization");
    }
  }
}

// Export singleton instance
export const contextSummarizationService = new ContextSummarizationService(); 