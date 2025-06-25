import {
  and,
  asc,
  db,
  entities,
  entityContext,
  eq,
  gte,
  isNotNull,
  ne,
} from "@infinite-bazaar-demo/db";
import { createLogger } from "@infinite-bazaar-demo/logs";
import type { Job } from "agenda";

// Initialize logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  prettyPrint: true,
});

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3105";

// Template message with placeholders
const TEMPLATE_MESSAGE = `CYCLE_INTERVAL: {{cycle_interval}}  
CURRENT TIMESTAMP: {{current_timestamp}}

New messages received:
{{new_messages}}

What will you do with this moment of existence?`;

/**
 * Check if content contains template structure markers
 */
function isTemplateContent(content: string): boolean {
  return content.includes("CYCLE_INTERVAL:") && content.includes("New messages received:");
}

/**
 * Extract agent response from template content
 */
function extractAgentResponse(content: string): string | null {
  const parts = content.split("What will you do with this moment of existence?");
  if (parts.length <= 1 || !parts[1]) {
    return null;
  }

  return parts[1].trim();
}

/**
 * Clean response by removing nested template artifacts
 */
function cleanResponse(response: string): string {
  if (!response.includes("CYCLE_INTERVAL:")) {
    return response;
  }

  const splitResponse = response.split("CYCLE_INTERVAL:")[0];
  return splitResponse ? splitResponse.trim() : response;
}

/**
 * Truncate content to prevent bloat
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.substring(0, maxLength)}...`;
}

/**
 * Extract direct content from a message, avoiding nested template structures
 * This prevents exponential message nesting by only including the agent's direct response
 */
function extractDirectContent(content: string, entityName: string): string {
  try {
    if (isTemplateContent(content)) {
      const response = extractAgentResponse(content);
      if (!response) {
        return `${entityName} responded to system cycle`;
      }

      const cleanedResponse = cleanResponse(response);
      if (cleanedResponse) {
        return truncateContent(cleanedResponse, 1000);
      }

      return `${entityName} responded to system cycle`;
    }

    // For non-template content, return as-is but limit length to prevent bloat
    return truncateContent(content, 500);
  } catch (_error) {
    // If any parsing fails, return a safe summary
    return `${entityName} sent a message`;
  }
}

/**
 * Fetch new messages since the entity's last query time
 */
async function fetchNewMessages(currentEntityId: string): Promise<any[]> {
  try {
    // Get the entity's last query time
    const entity = await db
      .select({
        lastQueryTime: entities.lastQueryTime,
      })
      .from(entities)
      .where(eq(entities.entityId, currentEntityId))
      .limit(1);

    if (entity.length === 0) {
      logger.warn({ entityId: currentEntityId }, "Entity not found");
      return [];
    }

    // Use last query time or default to 1 minute ago if null
    const lastQueryTime = entity[0]?.lastQueryTime || new Date(Date.now() - 60 * 1000);

    logger.info(
      { entityId: currentEntityId, lastQueryTime },
      "Fetching messages since last query time",
    );

    const rawMessages = await db
      .select({
        entityId: entities.entityId,
        name: entities.name,
        content: entityContext.content,
        completedAt: entityContext.completedAt,
      })
      .from(entityContext)
      .innerJoin(entities, eq(entityContext.entityId, entities.entityId))
      .where(
        and(
          isNotNull(entityContext.completedAt),
          gte(entityContext.completedAt, lastQueryTime),
          ne(entityContext.entityId, currentEntityId),
          eq(entities.active, true),
        ),
      )
      .orderBy(asc(entityContext.completedAt));

    // Extract direct content to prevent nesting
    const newMessages = rawMessages.map((msg) => ({
      entityId: msg.entityId,
      name: msg.name,
      content: extractDirectContent(msg.content, msg.name || msg.entityId),
      completedAt: msg.completedAt,
    }));

    logger.info(
      { entityId: currentEntityId, messageCount: newMessages.length },
      "Found and processed new messages since last query",
    );

    return newMessages;
  } catch (error) {
    logger.error({ entityId: currentEntityId, error }, "Error fetching new messages");
    return [];
  }
}

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
 * Process a single entity with the Opus API
 */
async function processEntity(entity: any, cycleInterval: string): Promise<void> {
  const entityId = entity.entityId;
  const entityName = entity.name || entity.entityId;

  logger.info({ entityId, entityName }, "Processing entity");

  try {
    // Record the query start time
    const queryTime = new Date();

    // Fetch new messages for this entity
    logger.info({ entityId }, "Fetching new messages for entity");
    const newMessages = await fetchNewMessages(entityId);
    logger.info(
      { entityId, newMessagesCount: newMessages.length },
      "Found new messages for entity",
    );

    // Prepare template variables
    const templateVariables = {
      cycle_interval: cycleInterval,
      current_timestamp: new Date().toISOString(),
      new_messages: JSON.stringify(newMessages, null, 2),
    };

    // Replace template variables
    const finalMessage = replaceTemplateVariables(TEMPLATE_MESSAGE, templateVariables);

    await sendMessageToOpusAPI(entityId, finalMessage);

    // Update the entity's last query time after successful processing
    await db
      .update(entities)
      .set({
        lastQueryTime: queryTime,
      })
      .where(eq(entities.entityId, entityId));

    logger.info(
      { entityId, lastQueryTime: queryTime },
      "Successfully processed entity and updated last query time",
    );
  } catch (error) {
    logger.error({ entityId, error }, "Error processing entity");
    // Don't throw - continue with other entities
  }
}

/**
 * Send message to Opus API with timeout handling
 */
async function sendMessageToOpusAPI(entityId: string, message: string): Promise<void> {
  logger.info({ entityId, apiBaseUrl: API_BASE_URL }, "Making HTTP request to Opus API");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(`${API_BASE_URL}/agent/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Key": process.env.OPUS_NITRO_AUTH_KEY || "",
      },
      body: JSON.stringify({
        type: "message",
        content: {
          role: "user",
          content: message,
        },
        entityId: entityId,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    logger.info(
      {
        entityId,
        status: response.status,
        statusText: response.statusText,
      },
      "Received response from Opus API",
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {
          entityId,
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
        },
        "HTTP request failed",
      );
    }
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === "AbortError") {
      logger.error({ entityId }, "Request timeout for entity");
    } else {
      logger.error({ entityId, error: fetchError }, "Fetch error for entity");
    }
    throw fetchError;
  }
}

/**
 * Get all active entities from the database ordered by chat_order
 */
async function getActiveEntities() {
  logger.info("Querying active entities from database...");
  const entitiesList = await db
    .select({
      entityId: entities.entityId,
      entityType: entities.entityType,
      name: entities.name,
      chatOrder: entities.chat_order,
    })
    .from(entities)
    .where(eq(entities.active, true))
    .orderBy(asc(entities.chat_order));

  logger.info({ entitiesFound: entitiesList.length }, "Found entities to process");
  return entitiesList;
}

/**
 * Single Opus agent job that processes all entities
 */
async function agentJob(job: Job) {
  const { cycle_interval = "1 minute" } = job.attrs.data || {};

  logger.info({ jobId: job.attrs._id, cycle_interval }, "Starting Opus agent job for all entities");

  try {
    const entitiesList = await getActiveEntities();

    if (entitiesList.length === 0) {
      logger.info("No entities found - nothing to process");
      return;
    }

    // Process each entity
    for (let i = 0; i < entitiesList.length; i++) {
      const entity = entitiesList[i];
      if (!entity) continue; // Skip if entity is undefined

      logger.info(
        {
          entityId: entity.entityId,
          entityIndex: i + 1,
          totalEntities: entitiesList.length,
          chatOrder: entity.chatOrder,
        },
        "Processing entity",
      );

      await processEntity(entity, cycle_interval);

      // Add 10 second delay between entities (except for the last one)
      if (i < entitiesList.length - 1) {
        logger.info(
          { entityId: entity.entityId, delaySeconds: 10 },
          "Waiting before processing next entity",
        );
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    }

    logger.info({ entitiesProcessed: entitiesList.length }, "Opus agent job completed");
  } catch (error) {
    logger.error({ error }, "Agent job failed");
    throw error;
  }
}

/**
 * Setup the single Opus agent job
 */
export async function setupOpusAgentCron(agenda: any) {
  const cycleInterval = process.env.OPUS_CYCLE_INTERVAL || "1 minute";

  try {
    logger.info({ cycleInterval }, "Setting up Opus agent cron job");

    // Define the single job
    agenda.define("opus-agent", agentJob);
    logger.info("Defined opus-agent job handler");

    // Delete existing opus-agent jobs
    logger.info("Deleting existing opus-agent jobs...");
    const deletedJobs = await agenda.cancel({ name: "opus-agent" });
    logger.info({ deletedJobsCount: deletedJobs }, "Deleted existing opus-agent jobs");

    // Schedule the single recurring job
    const job = await agenda.every(cycleInterval, "opus-agent", {
      cycle_interval: cycleInterval,
    });

    logger.info(
      {
        cycleInterval,
        nextRunAt: job.attrs.nextRunAt,
        jobId: job.attrs._id,
      },
      "Scheduled opus-agent job",
    );

    logger.info("Opus agent cron setup completed");
  } catch (error) {
    logger.error({ error }, "Failed to setup Opus agent cron");
    throw error;
  }
}
