import { Hono } from "hono";
import { logger } from "@infinite-bazaar-demo/logs";
import { contextSummarizationService } from "../../services/context-summarization";
import { z } from "zod";

const internalRoutes = new Hono();

// Schema for summarization request
const SummarizationRequestSchema = z.object({
  entityId: z.string(),
  instanceId: z.string(),
});

/**
 * POST /internal/summarize
 * Trigger auto-summarization for an entity if needed
 */
internalRoutes.post("/summarize", async (c) => {
  try {
    const body = await c.req.json();
    const { entityId, instanceId } = SummarizationRequestSchema.parse(body);

    logger.info({ entityId, instanceId }, "Received auto-summarization request");

    // Trigger auto-summarization if needed
    await contextSummarizationService.autoSummarizeIfNeeded(entityId, instanceId);

    return c.json({ 
      success: true, 
      entityId, 
      instanceId,
      message: "Auto-summarization check completed" 
    });
  } catch (error) {
    logger.error({ error }, "Error in auto-summarization endpoint");
    
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Invalid request body", 
        details: error.errors 
      }, 400);
    }
    
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

/**
 * GET /internal/summarize/:entityId/:instanceId
 * Get summarization status for an entity
 */
internalRoutes.get("/summarize/:entityId/:instanceId", async (c) => {
  try {
    const entityId = c.req.param("entityId");
    const instanceId = c.req.param("instanceId");

    if (!entityId || !instanceId) {
      return c.json({ 
        success: false, 
        error: "entityId and instanceId are required" 
      }, 400);
    }

    logger.info({ entityId, instanceId }, "Getting summarization status");

    // Check if summarization is needed
    const needsSummarization = await contextSummarizationService.shouldSummarize(entityId, instanceId);
    
    // Get latest summary if available
    const latestSummary = await contextSummarizationService.getLatestSummary(entityId, instanceId);

    return c.json({
      success: true,
      entityId,
      instanceId,
      needsSummarization,
      hasLatestSummary: !!latestSummary,
      latestSummary: latestSummary ? {
        messageCount: latestSummary.messageCount,
        tokenEstimate: latestSummary.tokenEstimate,
        summaryLength: latestSummary.summaryText.length,
      } : null,
    });
  } catch (error) {
    logger.error({ error }, "Error getting summarization status");
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

export { internalRoutes }; 