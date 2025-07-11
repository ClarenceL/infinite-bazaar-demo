import { Agenda } from "agenda";
import "./environment";
import { createLogger } from "@infinite-bazaar-demo/logs";
import { setupOpusAgentCron } from "./jobs/agents/tick";

// Initialize logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  prettyPrint: true,
});

// Simple logging
logger.info("Starting infinite-bazaar cron service...");

// Check if demo mode is enabled
const isDemoMode = process.env.DEMO_MODE === 'true';
if (isDemoMode) {
  logger.info("Demo mode enabled - cron service disabled");
  logger.info("To run with agent activity, set DEMO_MODE=false or remove the environment variable");
  process.exit(0);
}

// MongoDB connection
const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017/infinite-bazaar-agenda";
logger.info({ mongoUrl }, "MongoDB configuration");

// Initialize Agenda
const agenda = new Agenda({
  db: { address: mongoUrl, collection: "agendaJobs" },
  processEvery: "5 second",
  maxConcurrency: 1,
});

logger.info({ processEvery: "5 seconds", maxConcurrency: 1 }, "Agenda configured");

// Basic event logging
agenda.on("ready", () => {
  logger.info("Agenda ready");
});

agenda.on("start", (job) => {
  logger.info({ jobName: job.attrs.name }, "Job started");
});

agenda.on("complete", (job) => {
  logger.info({ jobName: job.attrs.name }, "Job completed");
});

agenda.on("fail", (err, job) => {
  logger.error({ jobName: job.attrs.name, error: err.message }, "Job failed");
});

// Start agenda and setup Opus agent cron
async function start() {
  try {
    logger.info("Starting agenda...");
    await agenda.start();

    // Get instance ID from environment
    const instanceId = process.env.INSTANCE_ID || "default";
    logger.info({ instanceId }, "Setting up Opus agent cron...");
    await setupOpusAgentCron(agenda, instanceId);

    logger.info({ instanceId }, "Cron service started successfully");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Startup failed",
    );
    process.exit(1);
  }
}

start();
