import { logger } from "@infinite-bazaar-demo/logs";
import { Hono } from "hono";
import { chatService } from "./chat.service.js";

// Chat routes
export const chatRoutes = new Hono()
  // Get messages endpoint for polling
  .get("/messages", async (c) => {
    try {
      const limit = Number(c.req.query("limit")) || 50;
      const streamingOnly = c.req.query("streaming") === "true";

      logger.info({ limit, streamingOnly }, "Fetching chat messages");

      // Get messages based on streaming filter
      const messages = streamingOnly
        ? await chatService.getStreamingMessages()
        : await chatService.getMessages(limit);

      const response = {
        success: true,
        messages,
        count: messages.length,
        timestamp: Date.now(), // Current server timestamp for next poll
        streamingOnly, // Include this flag in response
      };

      return c.json(response);
    } catch (error) {
      logger.error({ error }, "Error fetching chat messages");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          messages: [],
          count: 0,
        },
        500,
      );
    }
  })

  // Get message count endpoint
  .get("/count", async (c) => {
    try {
      const count = await chatService.getMessageCount();

      return c.json({
        success: true,
        count,
      });
    } catch (error) {
      logger.error({ error }, "Error getting message count");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          count: 0,
        },
        500,
      );
    }
  })

  // Get latest message timestamp for polling optimization
  .get("/latest", async (c) => {
    try {
      const timestamp = await chatService.getLatestMessageTimestamp();

      return c.json({
        success: true,
        timestamp,
      });
    } catch (error) {
      logger.error({ error }, "Error getting latest message timestamp");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: null,
        },
        500,
      );
    }
  });
