import { logger } from "@infinite-bazaar-demo/logs";
import { Hono } from "hono";
import { chatService } from "./chat.service.js";

// Simple in-memory cache with 1-second TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class OptimisticCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly TTL = 1000; // 1 second in milliseconds

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  // Optional: Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }
}

const cache = new OptimisticCache();

// Clean up cache every 5 seconds to prevent memory leaks
setInterval(() => cache.cleanup(), 5000);

// Chat routes
export const chatRoutes = new Hono()
  // Get current instance ID
  .get("/instance", async (c) => {
    const instanceId = process.env.INSTANCE_ID || "default";
    return c.json({
      success: true,
      instanceId,
      message: "Current instance configuration"
    });
  })

  // Get messages endpoint for polling
  .get("/messages", async (c) => {
    try {
      const limit = Number(c.req.query("limit")) || 50;
      const streamingOnly = c.req.query("streaming") === "true";
      const entityId = c.req.query("entityId") || undefined;
      const excludeUserMessages = c.req.query("excludeUserMessages") === "true";
      const instanceId = c.req.query("instanceId") || "default";

      // Create cache key based on query parameters
      const cacheKey = `messages:${limit}:${streamingOnly}:${entityId || "all"}:${excludeUserMessages}:${instanceId}`;

      // Check cache first
      const cachedResponse = cache.get(cacheKey);
      if (cachedResponse) {
        logger.info(
          { limit, streamingOnly, entityId, excludeUserMessages, instanceId, cached: true },
          "Returning cached chat messages",
        );
        return c.json(cachedResponse);
      }

      logger.info(
        { limit, streamingOnly, entityId, excludeUserMessages, instanceId, cached: false },
        "Fetching chat messages from DB",
      );

      // Get messages based on streaming filter and entityId
      const messages = streamingOnly
        ? await chatService.getStreamingMessages(entityId, excludeUserMessages, instanceId)
        : await chatService.getMessages(limit, true, entityId, excludeUserMessages, instanceId);

      const response = {
        success: true,
        messages,
        count: messages.length,
        timestamp: Date.now(), // Current server timestamp for next poll
        streamingOnly, // Include this flag in response
        entityId: entityId || null, // Include entityId in response
        excludeUserMessages, // Include excludeUserMessages flag in response
        instanceId, // Include instanceId in response
      };

      // Cache the response
      cache.set(cacheKey, response);

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
      const entityId = c.req.query("entityId") || undefined;
      const instanceId = c.req.query("instanceId") || "default";
      const count = await chatService.getMessageCount(entityId, instanceId);

      return c.json({
        success: true,
        count,
        entityId: entityId || null,
        instanceId,
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
      const entityId = c.req.query("entityId") || undefined;
      const instanceId = c.req.query("instanceId") || "default";
      const cacheKey = `latest:${entityId || "all"}:${instanceId}`;

      // Check cache first
      const cachedResponse = cache.get(cacheKey);
      if (cachedResponse) {
        logger.info({ entityId, instanceId, cached: true }, "Returning cached latest message timestamp");
        return c.json(cachedResponse);
      }

      logger.info({ entityId, instanceId, cached: false }, "Fetching latest message timestamp from DB");

      const timestamp = await chatService.getLatestMessageTimestamp(entityId, instanceId);

      const response = {
        success: true,
        timestamp,
        entityId: entityId || null,
        instanceId,
      };

      // Cache the response
      cache.set(cacheKey, response);

      return c.json(response);
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
