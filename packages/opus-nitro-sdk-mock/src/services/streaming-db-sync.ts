import { and, db, entityContext, eq, isNull, lte } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";

interface StreamingSyncUpdate {
  contextId: string;
  type: "chunk" | "complete";
  content?: string; // For chunk updates
}

class StreamingDBSyncService {
  private queue: StreamingSyncUpdate[] = [];
  private processing = false;
  private enabled = false;

  constructor() {
    // Check if real-time sync is enabled via environment variable
    this.enabled = process.env.LLM_CHAT_DB_SYNC_REAL_TIME === "true";
    if (this.enabled) {
      logger.info("Real-time streaming DB sync enabled");
    }
  }

  /**
   * Create initial database record for streaming response
   */
  async createInitialRecord(params: {
    entityId: string;
    role: string;
    chatId?: string;
    sequence: number;
  }): Promise<string | null> {
    if (!this.enabled) return null;

    try {
      const contextId = `context_${Date.now()}_${Math.random().toString(36).substring(2)}`;

      await db.insert(entityContext).values({
        contextId,
        entityId: params.entityId,
        role: params.role,
        content: "", // Start with empty content
        sequence: params.sequence,
        contextType: "MESSAGE",
        chatId: params.chatId || null,
        completedAt: null, // Mark as streaming initially
      });

      logger.debug({ contextId }, "Created initial streaming record");
      return contextId;
    } catch (error) {
      logger.error({ error }, "Failed to create initial streaming record");
      return null;
    }
  }

  /**
   * Queue a chunk update for processing
   */
  queueChunkUpdate(contextId: string, chunkContent: string): void {
    if (!this.enabled || !contextId) return;

    this.queue.push({
      contextId,
      type: "chunk",
      content: chunkContent,
    });

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Queue completion update
   */
  queueCompletion(contextId: string): void {
    if (!this.enabled || !contextId) return;

    this.queue.push({
      contextId,
      type: "complete",
    });

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process the queue asynchronously
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const update = this.queue.shift();
        if (!update) continue;

        try {
          if (update.type === "chunk" && update.content) {
            await this.updateContent(update.contextId, update.content);
          } else if (update.type === "complete") {
            await this.markComplete(update.contextId);
          }
        } catch (error) {
          logger.error({ error, update }, "Failed to process streaming update");
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Update content by appending chunk
   */
  private async updateContent(contextId: string, chunkContent: string): Promise<void> {
    try {
      // Get current content and append the new chunk
      const current = await db
        .select({ content: entityContext.content })
        .from(entityContext)
        .where(eq(entityContext.contextId, contextId))
        .limit(1);

      if (current.length > 0) {
        const newContent = (current[0]?.content || "") + chunkContent;

        await db
          .update(entityContext)
          .set({ content: newContent })
          .where(eq(entityContext.contextId, contextId));
      }
    } catch (error) {
      logger.error({ error, contextId }, "Failed to update streaming content");
    }
  }

  /**
   * Mark record as complete
   */
  private async markComplete(contextId: string): Promise<void> {
    try {
      await db
        .update(entityContext)
        .set({ completedAt: new Date() })
        .where(eq(entityContext.contextId, contextId));

      logger.debug({ contextId }, "Marked streaming record as complete");
    } catch (error) {
      logger.error({ error, contextId }, "Failed to mark streaming record as complete");
    }
  }

  /**
   * Check if real-time sync is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Clean up incomplete streaming records with empty content
   * This handles cases where streaming was started but failed before any content was written
   */
  async cleanupFailedStreaming(contextId: string): Promise<void> {
    if (!this.enabled || !contextId) return;

    try {
      // Check if record exists and has empty content
      const record = await db
        .select({ content: entityContext.content })
        .from(entityContext)
        .where(eq(entityContext.contextId, contextId))
        .limit(1);

      if (record.length > 0 && record[0]?.content === "") {
        // Delete the empty incomplete record
        await db.delete(entityContext).where(eq(entityContext.contextId, contextId));

        logger.info({ contextId }, "Cleaned up failed streaming record with empty content");
      }
    } catch (error) {
      logger.error({ error, contextId }, "Failed to cleanup streaming record");
    }
  }

  /**
   * Clean up all incomplete records older than specified minutes with empty content
   */
  async cleanupStaleIncompleteRecords(olderThanMinutes = 5): Promise<void> {
    if (!this.enabled) return;

    try {
      const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);

      const deletedRecords = await db
        .delete(entityContext)
        .where(
          and(
            isNull(entityContext.completedAt),
            eq(entityContext.content, ""),
            lte(entityContext.createdAt, cutoffTime),
          ),
        )
        .returning({ contextId: entityContext.contextId });

      if (deletedRecords.length > 0) {
        logger.info(
          {
            deletedCount: deletedRecords.length,
            cutoffTime,
            deletedIds: deletedRecords.map((r) => r.contextId),
          },
          "Cleaned up stale incomplete streaming records",
        );
      }
    } catch (error) {
      logger.error({ error }, "Failed to cleanup stale incomplete records");
    }
  }
}

// Export singleton instance
export const streamingDBSync = new StreamingDBSyncService();
