import { logger } from "@infinite-bazaar-demo/logs";
import { Hono } from "hono";
import { cronService } from "./cron.service.js";

// Cron management routes
export const cronRoutes = new Hono()
  // Get status of all cron jobs
  .get("/status", async (c) => {
    try {
      logger.info("Getting all cron job statuses");
      
      const statuses = await cronService.getAllCronJobStatuses();
      
      return c.json({
        success: true,
        statuses,
        count: statuses.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, "Error getting cron job statuses");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          statuses: [],
          count: 0,
        },
        500,
      );
    }
  })

  // Get status of cron job for specific instance
  .get("/status/:instanceId", async (c) => {
    try {
      const instanceId = c.req.param("instanceId");
      
      if (!instanceId) {
        return c.json(
          {
            success: false,
            error: "Instance ID is required",
          },
          400,
        );
      }

      logger.info({ instanceId }, "Getting cron job status for instance");
      
      const status = await cronService.getCronJobStatus(instanceId);
      
      return c.json({
        success: true,
        status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, "Error getting cron job status");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          status: null,
        },
        500,
      );
    }
  })

  // Start cron job for specific instance
  .post("/start/:instanceId", async (c) => {
    try {
      const instanceId = c.req.param("instanceId");
      
      if (!instanceId) {
        return c.json(
          {
            success: false,
            error: "Instance ID is required",
          },
          400,
        );
      }

      // Get optional cycle interval from request body
      const body = await c.req.json().catch(() => ({}));
      const cycleInterval = body.cycleInterval || "1 minute";

      logger.info({ instanceId, cycleInterval }, "Starting cron job for instance");
      
      const status = await cronService.startCronJob(instanceId, cycleInterval);
      
      return c.json({
        success: true,
        status,
        message: `Cron job started for instance ${instanceId}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, "Error starting cron job");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          status: null,
        },
        500,
      );
    }
  })

  // Stop cron job for specific instance
  .post("/stop/:instanceId", async (c) => {
    try {
      const instanceId = c.req.param("instanceId");
      
      if (!instanceId) {
        return c.json(
          {
            success: false,
            error: "Instance ID is required",
          },
          400,
        );
      }

      logger.info({ instanceId }, "Stopping cron job for instance");
      
      const stopped = await cronService.stopCronJob(instanceId);
      
      return c.json({
        success: true,
        stopped,
        message: stopped 
          ? `Cron job stopped for instance ${instanceId}`
          : `No active cron job found for instance ${instanceId}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, "Error stopping cron job");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          stopped: false,
        },
        500,
      );
    }
  })

  // Update cron job interval for specific instance
  .post("/update/:instanceId", async (c) => {
    try {
      const instanceId = c.req.param("instanceId");
      
      if (!instanceId) {
        return c.json(
          {
            success: false,
            error: "Instance ID is required",
          },
          400,
        );
      }

      const body = await c.req.json().catch(() => ({}));
      const newInterval = body.cycleInterval;

      if (!newInterval) {
        return c.json(
          {
            success: false,
            error: "Cycle interval is required in request body",
          },
          400,
        );
      }

      logger.info({ instanceId, newInterval }, "Updating cron job interval for instance");
      
      const status = await cronService.updateCronJobInterval(instanceId, newInterval);
      
      return c.json({
        success: true,
        status,
        message: `Cron job interval updated to ${newInterval} for instance ${instanceId}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, "Error updating cron job interval");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          status: null,
        },
        500,
      );
    }
  }); 