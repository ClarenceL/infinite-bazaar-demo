import type { Job } from 'agenda';
import pino from 'pino';

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

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3105";

// Template message with placeholders
const TEMPLATE_MESSAGE = `CYCLE_INTERVAL: {{cycle_interval}}  
CURRENT TIMESTAMP: {{current_timestamp}}

What will you do with this moment of existence?`;

/**
 * Replace template variables in the message
 */
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
  }

  return result;
}

/**
 * Opus agent job - sends a templated message to the Opus API
 * Fire and forget - doesn't read the streaming response
 */
async function opusAgentJob(job: Job) {
  const { cycle_interval = "1 minute" } = job.attrs.data || {};

  logger.info({ jobId: job.attrs._id, cycle_interval }, "Starting Opus agent job");

  try {
    // Prepare template variables
    const templateVariables = {
      cycle_interval: cycle_interval,
      current_timestamp: new Date().toISOString(),
    };

    // Replace template variables
    const finalMessage = replaceTemplateVariables(TEMPLATE_MESSAGE, templateVariables);

    logger.info({
      jobId: job.attrs._id,
      templateVariables,
      messageLength: finalMessage.length
    }, "Sending template message to Opus");

    // Fire and forget HTTP request
    const response = await fetch(`${API_BASE_URL}/opus/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "message",
        content: {
          role: "user",
          content: finalMessage,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Don't read the response body - just fire and forget
    logger.info({
      jobId: job.attrs._id,
      status: response.status,
      contentType: response.headers.get("content-type")
    }, "Opus agent job completed successfully");

  } catch (error) {
    logger.error(error, "Opus agent job failed");
    throw error;
  }
}

/**
 * Setup recurring Opus agent job (only if it doesn't exist)
 */
export async function setupOpusAgentCron(agenda: any) {
  const cycleInterval = process.env.OPUS_CYCLE_INTERVAL || "1 minute";

  try {
    // Define the job
    agenda.define("opus-agent", opusAgentJob);

    // Check if the job already exists
    const existingJobs = await agenda.jobs({ name: "opus-agent" });

    if (existingJobs.length > 0) {
      logger.info(
        { cycleInterval, existingJobs: existingJobs.length },
        "Opus agent jobs already exist, skipping creation",
      );
      return;
    }

    // Schedule new repeating job
    await agenda.every(cycleInterval, "opus-agent", { cycle_interval: cycleInterval });

    logger.info({ cycleInterval }, "Opus agent cron job scheduled");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to setup Opus agent cron",
    );
    throw error;
  }
}
