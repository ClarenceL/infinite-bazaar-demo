import { Agenda, Job } from "agenda";
// @ts-ignore - agendash doesn't have proper types
import Agendash from "agendash";
import axios from "axios";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { MongoClient } from "mongodb";
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

// MongoDB connection configuration
const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017/infinite-bazaar-agenda";

// Initialize Agenda
const agenda = new Agenda({
  db: { address: mongoUrl, collection: "agendaJobs" },
  processEvery: "5 seconds", // Process jobs every 5 seconds
  maxConcurrency: 20, // Maximum number of jobs to run concurrently
});

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());

// Mount Agendash dashboard
app.use("/admin/queues", Agendash(agenda));

// Define health check job
agenda.define("health-check", async (job: Job) => {
  const { url } = job.attrs.data;
  const jobId = job.attrs._id;

  try {
    logger.info({ jobId, url }, "Starting health check");

    const response = await axios.get(url, {
      timeout: 5000,
      validateStatus: (status) => status < 500, // Accept any status < 500
    });

    logger.info(
      {
        jobId,
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
        jobId,
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
});

// Setup recurring health check job (only if it doesn't exist)
async function setupHealthCheckCron() {
  const healthCheckUrl = process.env.HEALTH_CHECK_URL || "http://localhost:3105/health";

  try {
    // Check if the job already exists
    const existingJobs = await agenda.jobs({ name: "health-check" });

    if (existingJobs.length > 0) {
      logger.info({ url: healthCheckUrl, existingJobs: existingJobs.length }, "Health check jobs already exist, skipping creation");
      return;
    }

    // Schedule new repeating job every 10 seconds
    await agenda.every("10 seconds", "health-check", { url: healthCheckUrl });

    logger.info({ url: healthCheckUrl }, "Health check cron job scheduled every 10 seconds");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to setup health check cron",
    );
    throw error;
  }
}

// Event handlers
agenda.on("ready", () => {
  logger.info("Agenda connected to MongoDB and ready");
});

agenda.on("start", (job: Job) => {
  logger.info({ jobId: job.attrs._id, jobName: job.attrs.name }, "Job started");
});

agenda.on("complete", (job: Job) => {
  logger.info({ jobId: job.attrs._id, jobName: job.attrs.name }, "Job completed");
});

agenda.on("fail", (err: Error, job: Job) => {
  logger.error(
    {
      jobId: job.attrs._id,
      jobName: job.attrs.name,
      error: err.message,
    },
    "Job failed",
  );
});

// Health endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "cron2-dashboard" });
});

// Job stats endpoint
app.get("/api/stats", async (req: Request, res: Response) => {
  try {
    // Get job counts from agenda
    const jobs = await agenda.jobs({});
    const completedJobs = jobs.filter((job) => job.attrs.lastFinishedAt);
    const failedJobs = jobs.filter((job) => job.attrs.failedAt);
    const runningJobs = jobs.filter((job) => job.attrs.lockedAt && !job.attrs.lastFinishedAt);

    res.json({
      queue: "health-check",
      total: jobs.length,
      completed: completedJobs.length,
      failed: failedJobs.length,
      active: runningJobs.length,
      waiting: jobs.length - completedJobs.length - failedJobs.length - runningJobs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Graceful shutdown
async function gracefulShutdown() {
  logger.info("Shutting down cron2 service...");

  try {
    await agenda.stop();
    logger.info("Cron2 service shut down successfully");
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

// Start the service
async function start() {
  try {
    logger.info("Starting infinite-bazaar cron2 service...");

    // Start agenda
    await agenda.start();

    // Setup health check cron (only if it doesn't exist)
    await setupHealthCheckCron();

    // Start Express server
    const port = process.env.CRON2_DASHBOARD_PORT || 3002;

    app.listen(port, () => {
      logger.info({ port }, "Agenda Dashboard server started");
      logger.info(`Agenda Dashboard UI available at: http://localhost:${port}/admin/queues`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`Job stats: http://localhost:${port}/api/stats`);
    });

    logger.info("Cron2 service started successfully");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to start cron2 service",
    );
    process.exit(1);
  }
}

// Start the service
start().catch((error) => {
  logger.error(
    { error: error instanceof Error ? error.message : "Unknown error" },
    "Unhandled error during startup",
  );
  process.exit(1);
});
