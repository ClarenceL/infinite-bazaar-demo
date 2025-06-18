import { db, entities } from "@infinite-bazaar-demo/db";
import type { Job } from "agenda";
import pino from "pino";

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
 * Opus agent job - sends a templated message to the Opus API for a specific entity
 * Fire and forget - doesn't read the streaming response
 */
async function opusAgentJob(job: Job) {
  const { cycle_interval = "1 minute", entityId, entityName } = job.attrs.data || {};

  logger.info(
    {
      jobId: job.attrs._id,
      cycle_interval,
      entityId,
      entityName,
    },
    "Starting Opus agent job for entity",
  );

  try {
    // Prepare template variables
    const templateVariables = {
      cycle_interval: cycle_interval,
      current_timestamp: new Date().toISOString(),
    };

    // Replace template variables
    const finalMessage = replaceTemplateVariables(TEMPLATE_MESSAGE, templateVariables);

    logger.info(
      {
        jobId: job.attrs._id,
        entityId,
        entityName,
        templateVariables,
        messageLength: finalMessage.length,
      },
      "Sending template message to Opus for entity",
    );

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
        entityId: entityId, // Pass the entity ID for message filtering
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Don't read the response body - just fire and forget
    logger.info(
      {
        jobId: job.attrs._id,
        entityId,
        entityName,
        status: response.status,
        contentType: response.headers.get("content-type"),
      },
      "Opus agent job completed successfully for entity",
    );
  } catch (error) {
    logger.error({ error, entityId, entityName }, "Opus agent job failed for entity");
    throw error;
  }
}

/**
 * Setup recurring Opus agent jobs for all entities (only if they don't exist)
 */
export async function setupOpusAgentCron(agenda: any) {
  const cycleInterval = process.env.OPUS_CYCLE_INTERVAL || "1 minute";

  try {
    // Define the job
    agenda.define("opus-agent", opusAgentJob);

    // Query all entities from the database
    const entitiesList = await db
      .select({
        entityId: entities.entityId,
        entityType: entities.entityType,
        name: entities.name,
        username: entities.username,
      })
      .from(entities);

    logger.info(
      {
        entitiesFound: entitiesList.length,
        cycleInterval,
      },
      "Found entities for Opus agent jobs",
    );

    let jobsCreated = 0;
    let jobsSkipped = 0;

    // Create a job for each entity
    for (const entity of entitiesList) {
      const jobName = `opus-agent-${entity.entityId}`;

      // Check if job already exists for this entity
      const existingJobs = await agenda.jobs({ name: jobName });

      if (existingJobs.length > 0) {
        logger.debug(
          {
            entityId: entity.entityId,
            entityName: entity.name || entity.username,
            jobName,
            existingJobs: existingJobs.length,
          },
          "Opus agent job already exists for entity, skipping",
        );
        jobsSkipped++;
        continue;
      }

      // Schedule new repeating job for this entity
      await agenda.every(cycleInterval, jobName, {
        cycle_interval: cycleInterval,
        entityId: entity.entityId,
        entityName: entity.name || entity.username,
        entityType: entity.entityType,
      });

      logger.info(
        {
          entityId: entity.entityId,
          entityName: entity.name || entity.username,
          entityType: entity.entityType,
          jobName,
          cycleInterval,
        },
        "Opus agent cron job scheduled for entity",
      );

      jobsCreated++;
    }

    logger.info(
      {
        totalEntities: entitiesList.length,
        jobsCreated,
        jobsSkipped,
        cycleInterval,
      },
      "Opus agent cron jobs setup completed",
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to setup Opus agent cron jobs",
    );
    throw error;
  }
}
