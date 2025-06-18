import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import axios from "axios";
import { Queue, Worker } from "bullmq";
import dotenv from "dotenv";
import { Hono } from "hono";
import Redis from "ioredis";
import pino from "pino";

import "./environment";

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
});

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number.parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ blocking operations
  retryDelayOnFailover: 100,
};

// Initialize Redis connection
const redis = new Redis(redisConfig);

// Initialize BullMQ components
const healthCheckQueue = new Queue("health-check", { connection: redis });

// Initialize Bull Dashboard
const app = new Hono();
const serverAdapter = new HonoAdapter(serveStatic);

createBullBoard({
  queues: [new BullMQAdapter(healthCheckQueue)],
  serverAdapter,
});

const basePath = "/admin/queues";
serverAdapter.setBasePath(basePath);
app.route(basePath, serverAdapter.registerPlugin());

// Health check job processor
const healthCheckWorker = new Worker(
  "health-check",
  async (job) => {
    const { url } = job.data;

    try {
      logger.info({ jobId: job.id, url }, "Starting health check");

      const response = await axios.get(url, {
        timeout: 5000,
        validateStatus: (status) => status < 500, // Accept any status < 500
      });

      logger.info(
        {
          jobId: job.id,
          url,
          status: response.status,
          statusText: response.statusText,
        },
        "Health check completed successfully",
      );

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        {
          jobId: job.id,
          url,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Health check failed",
      );

      // Don't throw error to avoid infinite retries
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  },
  { connection: redis },
);

// Error handling
redis.on("error", (error: Error) => {
  logger.error({ error: error.message }, "Redis connection error");
});

redis.on("connect", () => {
  logger.info("Connected to Redis");
});

healthCheckWorker.on("completed", (job, result) => {
  logger.info({ jobId: job.id, result }, "Job completed");
});

healthCheckWorker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, "Job failed");
});

// Setup recurring health check job
async function setupHealthCheckCron() {
  const healthCheckUrl = process.env.HEALTH_CHECK_URL || "http://localhost:3105/health";

  try {
    // Remove any existing repeatable jobs
    const repeatableJobs = await healthCheckQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await healthCheckQueue.removeRepeatableByKey(job.key);
    }

    // Add new repeatable job every 10 seconds
    await healthCheckQueue.add(
      "health-check",
      { url: healthCheckUrl },
      {
        repeat: {
          every: 10000, // 10 seconds in milliseconds
        },
        removeOnComplete: 10, // Keep last 10 completed jobs
        removeOnFail: 5, // Keep last 5 failed jobs
      },
    );

    logger.info({ url: healthCheckUrl }, "Health check cron job scheduled every 10 seconds");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to setup health check cron",
    );
    throw error;
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  logger.info("Shutting down cron service...");

  try {
    await healthCheckWorker.close();
    await healthCheckQueue.close();
    await redis.quit();
    logger.info("Cron service shut down successfully");
    process.exit(0);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Error during shutdown",
    );
    process.exit(1);
  }
}

// Handle shutdown signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start the Bull Dashboard server
async function startBullDashboard() {
  const port = process.env.CRON_DASHBOARD_PORT || 3001;

  // Add health endpoint to the Hono app
  app.get("/health", (c) => {
    return c.json({ status: "ok", service: "cron-dashboard" });
  });

  // Add queue stats endpoint
  app.get("/api/stats", async (c) => {
    try {
      const counts = await healthCheckQueue.getJobCounts();
      return c.json({
        queue: "health-check",
        ...counts,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  serve({ fetch: app.fetch, port: Number(port) }, ({ address, port: serverPort }) => {
    logger.info({ port: serverPort, address }, "Bull Dashboard server started");
    logger.info(`Bull Dashboard UI available at: http://localhost:${serverPort}${basePath}`);
    logger.info(`Health check: http://localhost:${serverPort}/health`);
    logger.info(`Queue stats: http://localhost:${serverPort}/api/stats`);
  });
}

// Start the cron service
async function start() {
  try {
    logger.info("Starting infinite-bazaar cron service...");

    // Setup health check cron (BullMQ will handle Redis connection)
    await setupHealthCheckCron();

    logger.info("Cron service started successfully");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to start cron service",
    );
    process.exit(1);
  }
}

// Start the service
Promise.all([start(), startBullDashboard()]).catch((error) => {
  logger.error(
    { error: error instanceof Error ? error.message : "Unknown error" },
    "Unhandled error during startup",
  );
  process.exit(1);
});
