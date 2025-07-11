import { db, x402ServiceCalls, x402Endpoints, entities, eq, desc, and, count, sql } from "@infinite-bazaar-demo/db";

interface EconomicTrends {
  transactionVolume: {
    total: number;
    last24h: number;
    trend: "up" | "down" | "stable";
    percentChange: number;
  };
  priceMetrics: {
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    popularPriceRange: string;
  };
  agentActivity: {
    totalAgents: number;
    activeProviders: number;
    activeConsumers: number;
    topEarners: Array<{
      name: string;
      earnings: number;
      serviceCount: number;
    }>;
  };
  servicePopularity: Array<{
    serviceName: string;
    provider: string;
    callCount: number;
    revenue: number;
    avgRating: number;
  }>;
}

class EconomicTrendsService {
  /**
   * Get current economic trends and marketplace metrics
   */
  async getEconomicTrends(instanceId: string = "default"): Promise<EconomicTrends> {
    try {
      const now = new Date();
      const last6Hours = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      const last12Hours = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      console.log(`[EconomicTrends] Fetching trends for instance: ${instanceId}`);

      // Get transaction volume metrics
      const transactionVolume = await this.getTransactionVolume(instanceId, last6Hours, last12Hours);
      console.log(`[EconomicTrends] Transaction volume:`, transactionVolume);
      
      // Get price metrics
      const priceMetrics = await this.getPriceMetrics(instanceId);
      console.log(`[EconomicTrends] Price metrics:`, priceMetrics);
      
      // Get agent activity
      const agentActivity = await this.getAgentActivity(instanceId, last24Hours);
      console.log(`[EconomicTrends] Agent activity:`, agentActivity);
      
      // Get service popularity
      const servicePopularity = await this.getServicePopularity(instanceId, last24Hours);
      console.log(`[EconomicTrends] Service popularity:`, servicePopularity);

      return {
        transactionVolume,
        priceMetrics,
        agentActivity,
        servicePopularity,
      };
    } catch (error) {
      console.error(`[EconomicTrends] Error fetching trends:`, error);
      throw error;
    }
  }

  /**
   * Get detailed economic trends with historical data
   */
  async getDetailedEconomicTrends(instanceId: string = "default"): Promise<EconomicTrends> {
    // For now, return the same data as regular trends
    // In the future, this could include historical charts and deeper analytics
    return this.getEconomicTrends(instanceId);
  }

  /**
   * Get transaction volume and trend data
   */
  private async getTransactionVolume(
    instanceId: string,
    last6Hours: Date,
    last12Hours: Date
  ) {
    try {
      console.log(`[EconomicTrends] Getting transaction volume for instance: ${instanceId}`);

      // Get total transaction volume
      const totalVolumeResult = await db
        .select({
          total: sql<string>`COALESCE(SUM(${x402ServiceCalls.paymentAmount}), 0)`,
        })
        .from(x402ServiceCalls)
        .where(
          and(
            eq(x402ServiceCalls.instanceId, instanceId),
            eq(x402ServiceCalls.success, true)
          )
        );

      const totalVolume = Number.parseFloat(totalVolumeResult[0]?.total || "0");

      // Get last 6 hours volume
      const last6hResult = await db
        .select({
          volume: sql<string>`COALESCE(SUM(${x402ServiceCalls.paymentAmount}), 0)`,
        })
        .from(x402ServiceCalls)
        .where(
          and(
            eq(x402ServiceCalls.instanceId, instanceId),
            eq(x402ServiceCalls.success, true),
            sql`${x402ServiceCalls.createdAt} > ${last6Hours.toISOString()}`
          )
        );

      const last6hVolume = Number.parseFloat(last6hResult[0]?.volume || "0");

      // Get 6-12 hours volume for trend calculation
      const previous6hResult = await db
        .select({
          volume: sql<string>`COALESCE(SUM(${x402ServiceCalls.paymentAmount}), 0)`,
        })
        .from(x402ServiceCalls)
        .where(
          and(
            eq(x402ServiceCalls.instanceId, instanceId),
            eq(x402ServiceCalls.success, true),
            sql`${x402ServiceCalls.createdAt} > ${last12Hours.toISOString()}`,
            sql`${x402ServiceCalls.createdAt} <= ${last6Hours.toISOString()}`
          )
        );

      const previous6hVolume = Number.parseFloat(previous6hResult[0]?.volume || "0");

      // Calculate trend and percentage change
      let trend: "up" | "down" | "stable" = "stable";
      let percentChange = 0;

      if (previous6hVolume > 0) {
        percentChange = ((last6hVolume - previous6hVolume) / previous6hVolume) * 100;
        if (percentChange > 5) trend = "up";
        else if (percentChange < -5) trend = "down";
      } else if (last6hVolume > 0) {
        trend = "up";
        percentChange = 100; // 100% increase from 0
      }

      console.log(`[EconomicTrends] Transaction volume results:`, {
        totalVolume,
        last6hVolume,
        previous6hVolume,
        trend,
        percentChange,
      });

      return {
        total: totalVolume,
        last24h: last6hVolume, // Keep the field name for now to avoid breaking frontend
        trend,
        percentChange,
      };
    } catch (error) {
      console.error(`[EconomicTrends] Error getting transaction volume:`, error);
      // Return default values on error
      return {
        total: 0,
        last24h: 0,
        trend: "stable" as const,
        percentChange: 0,
      };
    }
  }

  /**
   * Get price metrics for services
   */
  private async getPriceMetrics(instanceId: string) {
    try {
      console.log(`[EconomicTrends] Getting price metrics for instance: ${instanceId}`);

      const priceData = await db
        .select({
          price: x402Endpoints.price,
          totalCalls: x402Endpoints.totalCalls,
        })
        .from(x402Endpoints)
        .where(
          and(
            eq(x402Endpoints.instanceId, instanceId),
            eq(x402Endpoints.active, true)
          )
        );

      console.log(`[EconomicTrends] Price data found:`, priceData.length, "services");

      if (priceData.length === 0) {
        return {
          averagePrice: 0,
          minPrice: 0,
          maxPrice: 0,
          popularPriceRange: "No services available",
        };
      }

      const prices = priceData.map(item => Number.parseFloat(item.price || "0"));
      const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      // Calculate popular price range (where most services are)
      const priceRanges = {
        low: prices.filter(p => p < 0.1).length,
        medium: prices.filter(p => p >= 0.1 && p < 0.5).length,
        high: prices.filter(p => p >= 0.5).length,
      };

      let popularPriceRange = "Mixed";
      if (priceRanges.low > priceRanges.medium && priceRanges.low > priceRanges.high) {
        popularPriceRange = "Under $0.100";
      } else if (priceRanges.medium > priceRanges.high) {
        popularPriceRange = "$0.100 - $0.500";
      } else if (priceRanges.high > 0) {
        popularPriceRange = "Over $0.500";
      }

      console.log(`[EconomicTrends] Price metrics results:`, {
        averagePrice,
        minPrice,
        maxPrice,
        popularPriceRange,
      });

      return {
        averagePrice,
        minPrice,
        maxPrice,
        popularPriceRange,
      };
    } catch (error) {
      console.error(`[EconomicTrends] Error getting price metrics:`, error);
      // Return default values on error
      return {
        averagePrice: 0,
        minPrice: 0,
        maxPrice: 0,
        popularPriceRange: "Error loading prices",
      };
    }
  }

  /**
   * Get agent activity metrics
   */
  private async getAgentActivity(instanceId: string, last24Hours: Date) {
    try {
      console.log(`[EconomicTrends] Getting agent activity for instance: ${instanceId}`);

      // Get total agents
      const totalAgents = await db
        .select({
          count: count(),
        })
        .from(entities)
        .where(
          and(
            eq(entities.instanceId, instanceId),
            eq(entities.active, true)
          )
        );

      // Get active providers (unique agents with at least one service)
      const activeProviders = await db
        .select({
          count: sql<number>`COUNT(DISTINCT ${entities.entityId})`,
        })
        .from(entities)
        .innerJoin(x402Endpoints, eq(entities.entityId, x402Endpoints.agentId))
        .where(
          and(
            eq(entities.instanceId, instanceId),
            eq(entities.active, true),
            eq(x402Endpoints.active, true)
          )
        );

      // Get active consumers (unique agents with at least one purchase in last 24h)
      const activeConsumers = await db
        .select({
          count: sql<number>`COUNT(DISTINCT ${entities.entityId})`,
        })
        .from(entities)
        .innerJoin(x402ServiceCalls, eq(entities.entityId, x402ServiceCalls.callerAgentId))
        .where(
          and(
            eq(entities.instanceId, instanceId),
            eq(entities.active, true),
            sql`${x402ServiceCalls.createdAt} > ${last24Hours.toISOString()}`
          )
        );

      // Get top earners
      const topEarners = await db
        .select({
          name: entities.name,
          earnings: sql<string>`COALESCE(SUM(${x402ServiceCalls.paymentAmount}), 0)`,
          serviceCount: count(),
        })
        .from(entities)
        .innerJoin(x402Endpoints, eq(entities.entityId, x402Endpoints.agentId))
        .innerJoin(x402ServiceCalls, eq(x402Endpoints.endpointId, x402ServiceCalls.endpointId))
        .where(
          and(
            eq(entities.instanceId, instanceId),
            eq(entities.active, true),
            eq(x402ServiceCalls.success, true)
          )
        )
        .groupBy(entities.entityId, entities.name)
        .orderBy(desc(sql<string>`COALESCE(SUM(${x402ServiceCalls.paymentAmount}), 0)`))
        .limit(5);

      console.log(`[EconomicTrends] Agent activity results:`, {
        totalAgents: totalAgents[0]?.count,
        activeProviders: activeProviders[0]?.count,
        activeConsumers: activeConsumers[0]?.count,
        topEarnersCount: topEarners.length,
      });

      return {
        totalAgents: totalAgents[0]?.count || 0,
        activeProviders: activeProviders[0]?.count || 0,
        activeConsumers: activeConsumers[0]?.count || 0,
        topEarners: topEarners.map(earner => ({
          name: earner.name || "Unknown Agent",
          earnings: Number.parseFloat(earner.earnings || "0"),
          serviceCount: earner.serviceCount || 0,
        })),
      };
    } catch (error) {
      console.error(`[EconomicTrends] Error getting agent activity:`, error);
      // Return default values on error
      return {
        totalAgents: 0,
        activeProviders: 0,
        activeConsumers: 0,
        topEarners: [],
      };
    }
  }

  /**
   * Get service popularity metrics
   */
  private async getServicePopularity(instanceId: string, last24Hours: Date) {
    try {
      console.log(`[EconomicTrends] Getting service popularity for instance: ${instanceId}`);

      const popularServices = await db
        .select({
          serviceName: x402Endpoints.serviceName,
          provider: entities.name,
          callCount: count(x402ServiceCalls.callId),
          revenue: sql<string>`COALESCE(SUM(${x402ServiceCalls.paymentAmount}), 0)`,
        })
        .from(x402Endpoints)
        .innerJoin(entities, eq(x402Endpoints.agentId, entities.entityId))
        .innerJoin(x402ServiceCalls, eq(x402Endpoints.endpointId, x402ServiceCalls.endpointId))
        .where(
          and(
            eq(x402Endpoints.instanceId, instanceId),
            eq(x402Endpoints.active, true),
            eq(x402ServiceCalls.success, true),
            sql`${x402ServiceCalls.createdAt} > ${last24Hours.toISOString()}`
          )
        )
        .groupBy(x402Endpoints.endpointId, x402Endpoints.serviceName, entities.name)
        .orderBy(desc(count(x402ServiceCalls.callId)))
        .limit(10);

      console.log(`[EconomicTrends] Service popularity results:`, popularServices.length, "services");

      return popularServices.map(service => ({
        serviceName: service.serviceName,
        provider: service.provider || "Unknown Provider",
        callCount: service.callCount || 0,
        revenue: Number.parseFloat(service.revenue || "0"),
        avgRating: 4.5, // Mock rating for now
      }));
    } catch (error) {
      console.error(`[EconomicTrends] Error getting service popularity:`, error);
      // Return empty array on error
      return [];
    }
  }
}

export const economicTrendsService = new EconomicTrendsService(); 