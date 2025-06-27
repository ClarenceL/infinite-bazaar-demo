import {
  and,
  db,
  desc,
  entities,
  agentRelationships,
  eq,
  isNotNull,
} from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";

interface Entity {
  id: string;
  name: string;
  entityType: "AI" | "HUMAN";
  active: boolean;
  cdpAddress?: string;
  createdAt: number;
}

interface Relationship {
  id: string;
  observerAgentId: string;
  targetAgentId: string;
  relationshipSummary: string;
  trustScore: number;
  interactionCount: number;
  totalTransactionValue: string;
  lastInteractionAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface RelationshipGraphData {
  entities: Entity[];
  relationships: Relationship[];
  timestamp: number;
}

export class RelationshipsService {
  /**
   * Get all active entities
   */
  async getEntities(): Promise<Entity[]> {
    try {
      logger.info("Fetching entities from database");

      const dbEntities = await db
        .select({
          entityId: entities.entityId,
          name: entities.name,
          entityType: entities.entityType,
          active: entities.active,
          cdpAddress: entities.cdp_address,
          createdAt: entities.createdAt,
        })
        .from(entities)
        .where(eq(entities.active, true))
        .orderBy(desc(entities.createdAt));

      const entitiesResult: Entity[] = dbEntities.map((record) => ({
        id: record.entityId,
        name: record.name || "Unnamed",
        entityType: record.entityType as "AI" | "HUMAN",
        active: record.active || false,
        cdpAddress: record.cdpAddress || undefined,
        createdAt: record.createdAt?.getTime() || Date.now(),
      }));

      logger.info({ entityCount: entitiesResult.length }, "Entities fetched successfully");
      return entitiesResult;
    } catch (error) {
      logger.error({ error }, "Error fetching entities from database");
      throw error;
    }
  }

  /**
   * Get all agent relationships
   */
  async getRelationships(): Promise<Relationship[]> {
    try {
      logger.info("Fetching relationships from database");

      const dbRelationships = await db
        .select({
          id: agentRelationships.id,
          observerAgentId: agentRelationships.observerAgentId,
          targetAgentId: agentRelationships.targetAgentId,
          relationshipSummary: agentRelationships.relationshipSummary,
          trustScore: agentRelationships.trustScore,
          interactionCount: agentRelationships.interactionCount,
          totalTransactionValue: agentRelationships.totalTransactionValue,
          lastInteractionAt: agentRelationships.lastInteractionAt,
          createdAt: agentRelationships.createdAt,
          updatedAt: agentRelationships.updatedAt,
        })
        .from(agentRelationships)
        .orderBy(desc(agentRelationships.updatedAt));

      const relationshipsResult: Relationship[] = dbRelationships.map((record) => ({
        id: record.id,
        observerAgentId: record.observerAgentId,
        targetAgentId: record.targetAgentId,
        relationshipSummary: record.relationshipSummary,
        trustScore: record.trustScore,
        interactionCount: record.interactionCount,
        totalTransactionValue: record.totalTransactionValue,
        lastInteractionAt: record.lastInteractionAt?.getTime() || null,
        createdAt: record.createdAt?.getTime() || Date.now(),
        updatedAt: record.updatedAt?.getTime() || Date.now(),
      }));

      logger.info({ relationshipCount: relationshipsResult.length }, "Relationships fetched successfully");
      return relationshipsResult;
    } catch (error) {
      logger.error({ error }, "Error fetching relationships from database");
      throw error;
    }
  }

  /**
   * Get complete graph data (entities + relationships)
   */
  async getGraphData(): Promise<RelationshipGraphData> {
    try {
      logger.info("Fetching complete graph data");

      const [entitiesData, relationshipsData] = await Promise.all([
        this.getEntities(),
        this.getRelationships(),
      ]);

      // Filter relationships to only include those between active entities
      const activeEntityIds = new Set(entitiesData.map(e => e.id));
      const validRelationships = relationshipsData.filter(
        rel => activeEntityIds.has(rel.observerAgentId) && activeEntityIds.has(rel.targetAgentId)
      );

      const result: RelationshipGraphData = {
        entities: entitiesData,
        relationships: validRelationships,
        timestamp: Date.now(),
      };

      logger.info(
        {
          entityCount: entitiesData.length,
          relationshipCount: validRelationships.length
        },
        "Graph data fetched successfully"
      );

      return result;
    } catch (error) {
      logger.error({ error }, "Error fetching graph data");
      throw error;
    }
  }

  /**
   * Get the latest update timestamp for polling optimization
   */
  async getLatestUpdateTimestamp(): Promise<number | null> {
    try {
      // Get the most recent update from either entities or relationships
      const [latestEntity, latestRelationship] = await Promise.all([
        db
          .select({ updatedAt: entities.updatedAt })
          .from(entities)
          .where(eq(entities.active, true))
          .orderBy(desc(entities.updatedAt))
          .limit(1),
        db
          .select({ updatedAt: agentRelationships.updatedAt })
          .from(agentRelationships)
          .orderBy(desc(agentRelationships.updatedAt))
          .limit(1),
      ]);

      const entityTime = latestEntity[0]?.updatedAt?.getTime() || 0;
      const relationshipTime = latestRelationship[0]?.updatedAt?.getTime() || 0;

      const latestTime = Math.max(entityTime, relationshipTime);
      return latestTime > 0 ? latestTime : null;
    } catch (error) {
      logger.error({ error }, "Error getting latest update timestamp");
      return null;
    }
  }

  /**
   * Get relationship count for statistics
   */
  async getRelationshipCount(): Promise<number> {
    try {
      const result = await db
        .select({
          count: agentRelationships.id,
        })
        .from(agentRelationships);

      return result.length;
    } catch (error) {
      logger.error({ error }, "Error getting relationship count");
      return 0;
    }
  }
}

export const relationshipsService = new RelationshipsService(); 