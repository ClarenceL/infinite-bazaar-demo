import { logger } from "@infinite-bazaar-demo/logs";
import { Hono } from "hono";
import { relationshipsService } from "./relationships.service.js";

// Simple in-memory cache with 1-second TTL (same as chat system)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class OptimisticCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly TTL = 1000; // 1 second TTL

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

// Relationships routes
export const relationshipsRoutes = new Hono()
  // Get complete graph data endpoint for polling
  .get("/graph", async (c) => {
    try {
      // Create cache key
      const cacheKey = "graph:complete";

      // Check cache first
      const cachedResponse = cache.get(cacheKey);
      if (cachedResponse) {
        logger.info({ cached: true }, "Returning cached graph data");
        return c.json(cachedResponse);
      }

      logger.info({ cached: false }, "Fetching graph data from DB");

      // Get complete graph data
      const graphData = await relationshipsService.getGraphData();

      const response = {
        success: true,
        ...graphData,
      };

      // Cache the response
      cache.set(cacheKey, response);

      return c.json(response);
    } catch (error) {
      logger.error({ error }, "Error fetching graph data");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          entities: [],
          relationships: [],
          timestamp: Date.now(),
        },
        500,
      );
    }
  })

  // Get entities only
  .get("/entities", async (c) => {
    try {
      const cacheKey = "entities:all";

      const cachedResponse = cache.get(cacheKey);
      if (cachedResponse) {
        logger.info({ cached: true }, "Returning cached entities");
        return c.json(cachedResponse);
      }

      logger.info({ cached: false }, "Fetching entities from DB");

      const entities = await relationshipsService.getEntities();

      const response = {
        success: true,
        entities,
        count: entities.length,
        timestamp: Date.now(),
      };

      cache.set(cacheKey, response);

      return c.json(response);
    } catch (error) {
      logger.error({ error }, "Error fetching entities");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          entities: [],
          count: 0,
        },
        500,
      );
    }
  })

  // Get relationships only
  .get("/relationships", async (c) => {
    try {
      const cacheKey = "relationships:all";

      const cachedResponse = cache.get(cacheKey);
      if (cachedResponse) {
        logger.info({ cached: true }, "Returning cached relationships");
        return c.json(cachedResponse);
      }

      logger.info({ cached: false }, "Fetching relationships from DB");

      const relationships = await relationshipsService.getRelationships();

      const response = {
        success: true,
        relationships,
        count: relationships.length,
        timestamp: Date.now(),
      };

      cache.set(cacheKey, response);

      return c.json(response);
    } catch (error) {
      logger.error({ error }, "Error fetching relationships");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          relationships: [],
          count: 0,
        },
        500,
      );
    }
  })

  // Get latest update timestamp for polling optimization
  .get("/latest", async (c) => {
    try {
      const cacheKey = "latest:timestamp";

      const cachedResponse = cache.get(cacheKey);
      if (cachedResponse) {
        logger.info({ cached: true }, "Returning cached latest timestamp");
        return c.json(cachedResponse);
      }

      logger.info({ cached: false }, "Fetching latest timestamp from DB");

      const timestamp = await relationshipsService.getLatestUpdateTimestamp();

      const response = {
        success: true,
        timestamp,
      };

      cache.set(cacheKey, response);

      return c.json(response);
    } catch (error) {
      logger.error({ error }, "Error getting latest timestamp");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: null,
        },
        500,
      );
    }
  })

  // Get relationship count for statistics
  .get("/count", async (c) => {
    try {
      const cacheKey = "relationships:count";

      const cachedResponse = cache.get(cacheKey);
      if (cachedResponse) {
        logger.info({ cached: true }, "Returning cached relationship count");
        return c.json(cachedResponse);
      }

      logger.info({ cached: false }, "Fetching relationship count from DB");

      const count = await relationshipsService.getRelationshipCount();

      const response = {
        success: true,
        count,
      };

      cache.set(cacheKey, response);

      return c.json(response);
    } catch (error) {
      logger.error({ error }, "Error getting relationship count");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          count: 0,
        },
        500,
      );
    }
  });
