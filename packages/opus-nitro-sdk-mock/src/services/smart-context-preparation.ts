import { logger } from "@infinite-bazaar-demo/logs";
import { contextSummarizationService } from "./context-summarization";
import { db, x402ServiceCalls, x402Endpoints, entities, eq, desc, and, count, sql } from "@infinite-bazaar-demo/db";
import type { Message } from "../types/message";

// Configuration
const RECENT_MESSAGES_COUNT = 4; // Reduced from 8 to 4 messages for immediate context
const MAX_CONTEXT_TOKENS = 15000; // Reduced from 50K to 15K tokens
const SUMMARY_WEIGHT = 0.4; // Increased to 40% of token budget for summary, 60% for recent messages

interface SmartContextResult {
  recentMessages: Message[];
  historicalSummary?: string;
  marketplaceSummary?: string;
  totalEstimatedTokens: number;
  tokenSavings: number; // Compared to loading all messages
}

interface MarketplaceSummary {
  recentActivity: string;
  popularServices: string;
  marketTrends: string;
  priceRanges: string;
}

/**
 * Smart Context Preparation Service
 * Combines recent messages with historical summaries for efficient context management
 */
export class SmartContextPreparationService {
  
  /**
   * Estimate token count for a message (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Very rough token estimation (4 chars ≈ 1 token)
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate marketplace summary with recent activity and trends
   */
  async generateMarketplaceSummary(instanceId: string): Promise<MarketplaceSummary> {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get recent service calls (last 24 hours)
      const recentCalls = await db
        .select({
          serviceName: x402Endpoints.serviceName,
          provider: entities.name,
          price: x402ServiceCalls.paymentAmount,
          success: x402ServiceCalls.success,
          createdAt: x402ServiceCalls.createdAt,
        })
        .from(x402ServiceCalls)
        .innerJoin(x402Endpoints, eq(x402ServiceCalls.endpointId, x402Endpoints.endpointId))
        .innerJoin(entities, eq(x402Endpoints.agentId, entities.entityId))
        .where(
          and(
            eq(x402ServiceCalls.instanceId, instanceId),
            sql`${x402ServiceCalls.createdAt} > ${last24Hours}`
          )
        )
        .orderBy(desc(x402ServiceCalls.createdAt))
        .limit(10);

      // Get popular services (most called in last week)
      const popularServices = await db
        .select({
          serviceName: x402Endpoints.serviceName,
          provider: entities.name,
          callCount: count(x402ServiceCalls.callId),
          totalRevenue: sql<string>`SUM(${x402ServiceCalls.paymentAmount})`,
          avgPrice: sql<string>`AVG(${x402ServiceCalls.paymentAmount})`,
        })
        .from(x402ServiceCalls)
        .innerJoin(x402Endpoints, eq(x402ServiceCalls.endpointId, x402Endpoints.endpointId))
        .innerJoin(entities, eq(x402Endpoints.agentId, entities.entityId))
        .where(
          and(
            eq(x402ServiceCalls.instanceId, instanceId),
            sql`${x402ServiceCalls.createdAt} > ${lastWeek}`
          )
        )
        .groupBy(x402Endpoints.serviceName, entities.name)
        .orderBy(desc(count(x402ServiceCalls.callId)))
        .limit(5);

      // Get active services and price ranges
      const activeServices = await db
        .select({
          serviceName: x402Endpoints.serviceName,
          price: x402Endpoints.price,
          serviceType: x402Endpoints.serviceType,
          totalCalls: x402Endpoints.totalCalls,
        })
        .from(x402Endpoints)
        .where(
          and(
            eq(x402Endpoints.instanceId, instanceId),
            eq(x402Endpoints.active, true)
          )
        )
        .orderBy(desc(x402Endpoints.totalCalls));

      // Format recent activity
      const recentActivity = recentCalls.length > 0 
        ? `Recent transactions: ${recentCalls.slice(0, 3).map(call => 
            `${call.provider} provided "${call.serviceName}" for ${call.price} USDC (${call.success ? 'successful' : 'failed'})`
          ).join(', ')}`
        : "No recent marketplace activity";

      // Format popular services
      const popularList = popularServices.length > 0
        ? `Popular services: ${popularServices.map(service => 
            `"${service.serviceName}" by ${service.provider} (${service.callCount} calls, ${Number.parseFloat(service.totalRevenue).toFixed(2)} USDC earned)`
          ).join(', ')}`
        : "No popular services identified";

      // Format market trends
      const priceRanges = activeServices.length > 0 
        ? (() => {
            const prices = activeServices.map(s => Number.parseFloat(s.price));
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            return `Price ranges: ${minPrice.toFixed(3)} - ${maxPrice.toFixed(3)} USDC (avg: ${avgPrice.toFixed(3)} USDC)`;
          })()
        : "No active services";

      const marketTrends = `Active services: ${activeServices.length}, Recent activity: ${recentCalls.length} transactions in 24h`;

      return {
        recentActivity,
        popularServices: popularList,
        marketTrends,
        priceRanges,
      };
    } catch (error) {
      logger.error({ error, instanceId }, "Error generating marketplace summary");
      return {
        recentActivity: "Unable to fetch recent activity",
        popularServices: "Popular services data unavailable",
        marketTrends: "Market trends unavailable",
        priceRanges: "Price data unavailable",
      };
    }
  }

  /**
   * Format marketplace summary for context inclusion
   */
  formatMarketplaceSummary(summary: MarketplaceSummary): string {
    return `
## Marketplace Context
${summary.recentActivity}
${summary.popularServices}
${summary.marketTrends}
${summary.priceRanges}

This marketplace context helps you understand current activity and make informed decisions about services to offer or purchase.`;
  }

  /**
   * Prepare smart context with recent messages + historical summary + marketplace context
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
      
      // 3. Get marketplace summary (current market activity)
      const marketplaceSummaryData = await this.generateMarketplaceSummary(instanceId);
      const marketplaceSummary = this.formatMarketplaceSummary(marketplaceSummaryData);
      
      // 4. Calculate token estimates
      const recentTokens = recentMessages.reduce((total, msg) => {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        return total + this.estimateTokenCount(content);
      }, 0);
      
      const summaryTokens = historicalSummary ? 
        this.estimateTokenCount(historicalSummary.summaryText) : 0;
      
      const marketplaceTokens = this.estimateTokenCount(marketplaceSummary);
      
      const totalTokens = recentTokens + summaryTokens + marketplaceTokens;
      
      // 5. Calculate token savings (compared to loading all messages)
      const allMessagesTokens = allMessages.reduce((total, msg) => {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        return total + this.estimateTokenCount(content);
      }, 0);
      
      const tokenSavings = allMessagesTokens - totalTokens;
      
      // 6. Auto-trigger summarization if needed
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
          marketplaceTokens,
          totalTokens,
          tokenSavings,
          tokenSavingsPercent: Math.round((tokenSavings / allMessagesTokens) * 100),
          processingTime,
          hasSummary: !!historicalSummary,
          hasMarketplaceContext: true
        },
        "Smart context preparation completed with marketplace context"
      );
      
      return {
        recentMessages,
        historicalSummary: historicalSummary?.summaryText,
        marketplaceSummary,
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