import { Hono } from "hono";
import { economicTrendsService } from "./economic-trends.service.js";

const economicTrendsRoutes = new Hono();

/**
 * GET /api/economic-trends
 * Get current economic trends and marketplace metrics
 */
economicTrendsRoutes.get("/", async (c) => {
  try {
    const instanceId = c.req.query("instance") || "default";
    const trends = await economicTrendsService.getEconomicTrends(instanceId);
    
    return c.json({
      success: true,
      data: trends,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching economic trends:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch economic trends",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * GET /api/economic-trends/detailed
 * Get detailed economic analysis with historical data
 */
economicTrendsRoutes.get("/detailed", async (c) => {
  try {
    const instanceId = c.req.query("instance") || "default";
    const detailedTrends = await economicTrendsService.getDetailedEconomicTrends(instanceId);
    
    return c.json({
      success: true,
      data: detailedTrends,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching detailed economic trends:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch detailed economic trends",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

export { economicTrendsRoutes }; 