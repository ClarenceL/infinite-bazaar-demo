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
  // Get messages endpoint for polling
  .get("/messages", async (c) => {
    try {
      const limit = Number(c.req.query("limit")) || 50;
      const streamingOnly = c.req.query("streaming") === "true";

      // Create cache key based on query parameters
      const cacheKey = `messages:${limit}:${streamingOnly}`;

      // Check cache first
      const cachedResponse = cache.get(cacheKey);
      if (cachedResponse) {
        logger.info({ limit, streamingOnly, cached: true }, "Returning cached chat messages");
        return c.json(cachedResponse);
      }

      logger.info({ limit, streamingOnly, cached: false }, "Fetching chat messages from DB");

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
      const cacheKey = "latest";

      // Check cache first
      const cachedResponse = cache.get(cacheKey);
      if (cachedResponse) {
        logger.info({ cached: true }, "Returning cached latest message timestamp");
        return c.json(cachedResponse);
      }

      logger.info({ cached: false }, "Fetching latest message timestamp from DB");

      const timestamp = await chatService.getLatestMessageTimestamp();

      const response = {
        success: true,
        timestamp,
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
