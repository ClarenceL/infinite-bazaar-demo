import { logger } from "@infinite-bazaar-demo/logs";
import { contextSummarizationService } from "./context-summarization";
import type { Message } from "../types/message";

// Configuration
const RECENT_MESSAGES_COUNT = 8; // Keep last 8 messages for immediate context
const MAX_CONTEXT_TOKENS = 15000; // Reduced from 50K to 15K tokens
const SUMMARY_WEIGHT = 0.3; // 30% of token budget for summary, 70% for recent messages

interface SmartContextResult {
  recentMessages: Message[];
  historicalSummary?: string;
  totalEstimatedTokens: number;
  tokenSavings: number; // Compared to loading all messages
}

/**
 * Smart Context Preparation Service
 * Combines recent messages with historical summaries for efficient context management
 */
export class SmartContextPreparationService {
  
  /**
   * Estimate token count for a message (rough approximation)
   */
  private estimateTokenCount(content: string): number {
    return Math.ceil(content.length / 4); // Rough estimate: 1 token per 4 characters
  }

  /**
   * Prepare smart context with recent messages + historical summary
   */
  async prepareSmartContext(
    allMessages: Message[],
    entityId: string,
    instanceId: string
  ): Promise<SmartContextResult> {
    
    const startTime = Date.now();
    
    try {
      // 1. Get recent messages (last N messages)
      const recentMessages = allMessages.slice(-RECENT_MESSAGES_COUNT);
      
      // 2. Get historical summary (everything before recent messages)
      const historicalSummary = await contextSummarizationService.getLatestSummary(
        entityId, 
        instanceId
      );
      
      // 3. Calculate token estimates
      const recentTokens = recentMessages.reduce((total, msg) => {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        return total + this.estimateTokenCount(content);
      }, 0);
      
      const summaryTokens = historicalSummary ? 
        this.estimateTokenCount(historicalSummary.summaryText) : 0;
      
      const totalTokens = recentTokens + summaryTokens;
      
      // 4. Calculate token savings (compared to loading all messages)
      const allMessagesTokens = allMessages.reduce((total, msg) => {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        return total + this.estimateTokenCount(content);
      }, 0);
      
      const tokenSavings = allMessagesTokens - totalTokens;
      
      // 5. Auto-trigger summarization if needed
      await contextSummarizationService.autoSummarizeIfNeeded(entityId, instanceId);
      
      const processingTime = Date.now() - startTime;
      
      logger.info(
        {
          entityId,
          instanceId,
          recentMessageCount: recentMessages.length,
          totalMessageCount: allMessages.length,
          recentTokens,
          summaryTokens,
          totalTokens,
          tokenSavings,
          tokenSavingsPercent: Math.round((tokenSavings / allMessagesTokens) * 100),
          processingTime,
          hasSummary: !!historicalSummary
        },
        "Smart context preparation completed"
      );
      
      return {
        recentMessages,
        historicalSummary: historicalSummary?.summaryText,
        totalEstimatedTokens: totalTokens,
        tokenSavings,
      };
      
    } catch (error) {
      logger.error({ error, entityId, instanceId }, "Error in smart context preparation");
      
      // Fallback to recent messages only
      const fallbackMessages = allMessages.slice(-RECENT_MESSAGES_COUNT);
      const fallbackTokens = fallbackMessages.reduce((total, msg) => {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        return total + this.estimateTokenCount(content);
      }, 0);
      
      return {
        recentMessages: fallbackMessages,
        totalEstimatedTokens: fallbackTokens,
        tokenSavings: 0,
      };
    }
  }

  /**
   * Check if context fits within token budget
   */
  isContextWithinBudget(estimatedTokens: number): boolean {
    return estimatedTokens <= MAX_CONTEXT_TOKENS;
  }

  /**
   * Get context preparation stats for debugging
   */
  async getContextStats(entityId: string, instanceId: string): Promise<{
    totalMessages: number;
    hasHistoricalSummary: boolean;
    lastSummaryDate?: string;
    summarizedMessageCount?: number;
  }> {
    try {
      // This would need to be implemented based on your message loading logic
      // For now, returning basic stats
      const summary = await contextSummarizationService.getLatestSummary(entityId, instanceId);
      
      return {
        totalMessages: 0, // Would need to count actual messages
        hasHistoricalSummary: !!summary,
        lastSummaryDate: summary ? new Date().toISOString() : undefined,
        summarizedMessageCount: summary?.messageCount,
      };
    } catch (error) {
      logger.error({ error, entityId, instanceId }, "Error getting context stats");
      return {
        totalMessages: 0,
        hasHistoricalSummary: false,
      };
    }
  }

  /**
   * Format historical summary for system prompt inclusion
   */
  formatHistoricalSummary(summary: string): string {
    return `
## Historical Context Summary
The following is a summary of previous conversations and activities:

${summary}

## Current Conversation
The messages below represent the most recent part of the ongoing conversation:`;
  }
}

// Export singleton instance
export const smartContextPreparationService = new SmartContextPreparationService(); 