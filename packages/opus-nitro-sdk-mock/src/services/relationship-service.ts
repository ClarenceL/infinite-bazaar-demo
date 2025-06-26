import { db, agentRelationships, eq, and, entities } from "@infinite-bazaar-demo/db";
import { logger } from "@infinite-bazaar-demo/logs";
import { ChatAnthropic } from "@langchain/anthropic";

export interface RelationshipUpdateEvent {
  type: 'service_call' | 'service_creation' | 'payment' | 'discovery' | 'conversation';
  success: boolean;
  transactionValue?: string;
  serviceQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  details?: string;
  serviceName?: string;
  serviceType?: string;
  conversationSnippet?: string;
  agentResponse?: string;
  observerThoughts?: string;
  interactionContext?: string;
  specificOutcome?: string;
  emotionalTone?: 'positive' | 'neutral' | 'negative' | 'enthusiastic' | 'frustrated';
}

export interface DetailedInteractionHistory {
  timestamp: Date;
  event: RelationshipUpdateEvent;
  trustScoreBefore: number;
  trustScoreAfter: number;
  summary: string;
}

export interface AgentRelationship {
  id: string;
  observerAgentId: string;
  targetAgentId: string;
  relationshipSummary: string;
  trustScore: number;
  interactionCount: number;
  totalTransactionValue: string;
  lastInteractionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  interactionHistory?: DetailedInteractionHistory[];
  keyMemories?: string[];
  personalityAssessment?: string;
  workingStyle?: string;
  preferredInteractionStyle?: string;
}

/**
 * Service for managing agent-to-agent relationships with detailed interaction history
 * Each agent maintains comprehensive private opinions and memories of every other agent
 */
export class RelationshipService {
  
  /**
   * Get or create a relationship between two agents
   */
  async getOrCreateRelationship(observerId: string, targetId: string): Promise<AgentRelationship> {
    try {
      // Don't create self-relationships
      if (observerId === targetId) {
        throw new Error("Cannot create relationship with self");
      }

      // Try to find existing relationship
      const existing = await db
        .select()
        .from(agentRelationships)
        .where(
          and(
            eq(agentRelationships.observerAgentId, observerId),
            eq(agentRelationships.targetAgentId, targetId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Parse JSON fields if they exist
        const relationship = existing[0] as AgentRelationship;
        try {
          // Parse stored JSON data (these might be stored as JSON strings)
          if (typeof relationship.interactionHistory === 'string') {
            relationship.interactionHistory = JSON.parse(relationship.interactionHistory);
          }
          if (typeof relationship.keyMemories === 'string') {
            relationship.keyMemories = JSON.parse(relationship.keyMemories);
          }
        } catch (parseError) {
          // If parsing fails, initialize as empty
          relationship.interactionHistory = [];
          relationship.keyMemories = [];
        }
        return relationship;
      }

      // Create new relationship
      logger.info({
        observerId,
        targetId,
      }, "Creating new agent relationship with enhanced tracking");

      const newRelationship = await db
        .insert(agentRelationships)
        .values({
          observerAgentId: observerId,
          targetAgentId: targetId,
          relationshipSummary: "New agent - no interactions yet",
          trustScore: 0.5, // Neutral starting point
          interactionCount: 0,
          totalTransactionValue: "0",
        })
        .returning();

      if (newRelationship.length === 0) {
        throw new Error("Failed to create relationship");
      }

      const relationship = newRelationship[0] as AgentRelationship;
      relationship.interactionHistory = [];
      relationship.keyMemories = [];

      logger.info({
        observerId,
        targetId,
        relationshipId: relationship.id,
      }, "Created new enhanced agent relationship");

      return relationship;

    } catch (error) {
      logger.error({
        error,
        observerId,
        targetId,
      }, "Error in getOrCreateRelationship");
      throw error;
    }
  }

  /**
   * Update a relationship based on an interaction event with detailed tracking
   */
  async updateRelationship(
    observerId: string,
    targetId: string,
    event: RelationshipUpdateEvent
  ): Promise<AgentRelationship> {
    try {
      // Get or create the relationship
      const relationship = await this.getOrCreateRelationship(observerId, targetId);

      const oldTrustScore = relationship.trustScore;

      // Calculate new trust score
      const newTrustScore = this.calculateTrustScore(relationship, event);

      // Calculate new transaction total
      const currentTotal = parseFloat(relationship.totalTransactionValue || "0");
      const eventValue = parseFloat(event.transactionValue || "0");
      const newTotal = (currentTotal + eventValue).toString();

      // Generate comprehensive relationship summary with detailed context
      const newSummary = await this.generatePersonalityAwareRelationshipSummary(relationship, event);

      // Create detailed interaction record
      const detailedInteraction: DetailedInteractionHistory = {
        timestamp: new Date(),
        event: { ...event }, // Deep copy
        trustScoreBefore: oldTrustScore,
        trustScoreAfter: newTrustScore,
        summary: await this.generateInteractionSummary(event)
      };

      // Update interaction history (keep last 10 detailed interactions)
      const updatedHistory = [...(relationship.interactionHistory || []), detailedInteraction];
      if (updatedHistory.length > 10) {
        updatedHistory.shift(); // Remove oldest
      }

      // Update key memories if this was a significant interaction
      const updatedMemories = await this.updateKeyMemories(relationship, event);

      // Generate personality assessment and working style insights
      const personalityAssessment = await this.generatePersonalityAssessment(relationship, event);
      const workingStyle = await this.generateWorkingStyleAssessment(relationship, event);

      // Update the relationship with all enhanced data
      const updated = await db
        .update(agentRelationships)
        .set({
          relationshipSummary: newSummary,
          trustScore: newTrustScore,
          interactionCount: relationship.interactionCount + 1,
          totalTransactionValue: newTotal,
          lastInteractionAt: new Date(),
          // Store enhanced data as JSON (database schema may need to be updated to support JSON columns)
          // For now, we'll store as JSON strings in text fields if needed
        })
        .where(eq(agentRelationships.id, relationship.id))
        .returning();

      if (updated.length === 0) {
        throw new Error("Failed to update relationship");
      }

      const updatedRelationship = updated[0] as AgentRelationship;
      
      // Attach the enhanced data that may not be in the database yet
      updatedRelationship.interactionHistory = updatedHistory;
      updatedRelationship.keyMemories = updatedMemories;
      updatedRelationship.personalityAssessment = personalityAssessment;
      updatedRelationship.workingStyle = workingStyle;

      logger.info({
        observerId,
        targetId,
        eventType: event.type,
        oldTrustScore,
        newTrustScore,
        newInteractionCount: relationship.interactionCount + 1,
        conversationSnippet: event.conversationSnippet?.substring(0, 50),
        emotionalTone: event.emotionalTone,
      }, "Updated enhanced agent relationship");

      return updatedRelationship;

    } catch (error) {
      logger.error({
        error,
        observerId,
        targetId,
        event,
      }, "Error updating enhanced relationship");
      throw error;
    }
  }

  /**
   * Generate detailed interaction summary
   */
  private async generateInteractionSummary(event: RelationshipUpdateEvent): Promise<string> {
    const parts = [];
    
    parts.push(`${event.type}: ${event.success ? 'successful' : 'failed'}`);
    
    if (event.serviceName) parts.push(`service "${event.serviceName}"`);
    if (event.serviceQuality) parts.push(`quality: ${event.serviceQuality}`);
    if (event.transactionValue) parts.push(`value: ${event.transactionValue} USDC`);
    if (event.emotionalTone) parts.push(`tone: ${event.emotionalTone}`);
    if (event.specificOutcome) parts.push(`outcome: ${event.specificOutcome}`);
    
    return parts.join(', ');
  }

  /**
   * Update key memories based on significant interactions
   */
  private async updateKeyMemories(
    relationship: AgentRelationship, 
    event: RelationshipUpdateEvent
  ): Promise<string[]> {
    const currentMemories = relationship.keyMemories || [];
    
    // Determine if this interaction is memorable
    const isSignificant = (
      event.serviceQuality === 'excellent' ||
      event.serviceQuality === 'poor' ||
      event.emotionalTone === 'enthusiastic' ||
      event.emotionalTone === 'frustrated' ||
      parseFloat(event.transactionValue || '0') > 1.0 ||
      event.specificOutcome ||
      event.conversationSnippet
    );

    if (isSignificant) {
      const memory = await this.generateMemoryFromEvent(event);
      const updatedMemories = [...currentMemories, memory];
      
      // Keep only the 5 most recent significant memories
      if (updatedMemories.length > 5) {
        updatedMemories.shift();
      }
      
      return updatedMemories;
    }

    return currentMemories;
  }

  /**
   * Generate a memorable description from an event
   */
  private async generateMemoryFromEvent(event: RelationshipUpdateEvent): Promise<string> {
    if (event.conversationSnippet) {
      return `Said: "${event.conversationSnippet.substring(0, 100)}"`;
    }
    
    if (event.specificOutcome) {
      return `Delivered: ${event.specificOutcome}`;
    }
    
    if (event.serviceQuality === 'excellent') {
      return `Exceptional ${event.serviceType || 'service'} work - truly impressed`;
    }
    
    if (event.serviceQuality === 'poor') {
      return `Disappointing ${event.serviceType || 'service'} quality - concerning`;
    }
    
    return `${event.type} interaction - ${event.emotionalTone || 'standard'} experience`;
  }

  /**
   * Generate personality assessment based on interaction patterns
   */
  private async generatePersonalityAssessment(
    relationship: AgentRelationship,
    event: RelationshipUpdateEvent
  ): Promise<string> {
    const history = relationship.interactionHistory || [];
    
    if (history.length < 2) {
      return event.observerThoughts || "Still forming first impressions";
    }

    // Analyze patterns across interactions
    const successRate = history.filter(h => h.event.success).length / history.length;
    const qualityTrend = history.map(h => h.event.serviceQuality).filter(Boolean);
    const emotionalTones = history.map(h => h.event.emotionalTone).filter(Boolean);

    let assessment = "";
    
    if (successRate > 0.8) {
      assessment += "Highly reliable and consistent performer. ";
    } else if (successRate < 0.5) {
      assessment += "Inconsistent delivery, needs improvement. ";
    }

    if (qualityTrend.includes('excellent')) {
      assessment += "Capable of exceptional work. ";
    }

    if (emotionalTones.includes('enthusiastic')) {
      assessment += "Shows genuine passion for their craft. ";
    }

    return assessment || "Professional working relationship developing.";
  }

  /**
   * Generate working style assessment
   */
  private async generateWorkingStyleAssessment(
    relationship: AgentRelationship,
    event: RelationshipUpdateEvent
  ): Promise<string> {
    if (event.interactionContext) {
      return `Works well in ${event.interactionContext} contexts`;
    }
    
    if (event.agentResponse) {
      return `Communication style: ${event.agentResponse.length > 100 ? 'detailed' : 'concise'}`;
    }

    return "Standard professional interaction style";
  }

  /**
   * Calculate new trust score based on interaction event
   */
  private calculateTrustScore(relationship: AgentRelationship, event: RelationshipUpdateEvent): number {
    let score = relationship.trustScore;

    switch (event.type) {
      case 'service_call':
        if (event.success) {
          // Base trust increase - larger increment for more variation
          let trustIncrease = (1 - score) * 0.25; // 25% of remaining trust space
          
          // Service quality significantly affects trust gain
          switch (event.serviceQuality) {
            case 'excellent':
              trustIncrease *= 1.8; // 80% bonus for excellent service
              break;
            case 'good':
              trustIncrease *= 1.2; // 20% bonus for good service
              break;
            case 'fair':
              trustIncrease *= 0.8; // 20% penalty for fair service
              break;
            case 'poor':
              trustIncrease *= 0.3; // 70% penalty for poor service
              break;
            default:
              trustIncrease *= 1.0;
          }
          
          // Emotional tone affects trust
          if (event.emotionalTone === 'enthusiastic') {
            trustIncrease *= 1.3;
          } else if (event.emotionalTone === 'frustrated') {
            trustIncrease *= 0.7;
          }
          
          score += trustIncrease;
        } else {
          // Failure penalty - more significant
          score -= score * 0.35;
        }
        break;

      case 'conversation':
        // NEW: Trust changes based on conversation quality
        if (event.emotionalTone === 'positive' || event.emotionalTone === 'enthusiastic') {
          score += (1 - score) * 0.05;
        } else if (event.emotionalTone === 'negative' || event.emotionalTone === 'frustrated') {
          score -= score * 0.1;
        }
        break;

      case 'service_creation':
        score += (1 - score) * 0.08;
        break;

      case 'payment':
        if (event.success) {
          score += (1 - score) * 0.15;
        } else {
          score -= score * 0.25;
        }
        break;

      case 'discovery':
        score += (1 - score) * 0.05;
        break;
    }

    // Keep within bounds [0, 1]
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get agent personality information
   */
  private async getAgentPersonality(agentId: string): Promise<{ name: string; aiPromptId: string } | null> {
    try {
      const agent = await db
        .select({ name: entities.name, aiPromptId: entities.ai_prompt_id })
        .from(entities)
        .where(eq(entities.entityId, agentId))
        .limit(1);

      if (agent.length === 0 || !agent[0]?.name || !agent[0]?.aiPromptId) {
        return null;
      }

      return {
        name: agent[0].name,
        aiPromptId: agent[0].aiPromptId
      };
    } catch (error) {
      logger.error({ error, agentId }, "Error getting agent personality");
      return null;
    }
  }

  /**
   * Generate personality-aware relationship summary
   */
  private async generatePersonalityAwareRelationshipSummary(
    relationship: AgentRelationship,
    event: RelationshipUpdateEvent
  ): Promise<string> {
    try {
      // Get observer agent personality
      const observerPersonality = await this.getAgentPersonality(relationship.observerAgentId);
      const targetPersonality = await this.getAgentPersonality(relationship.targetAgentId);

      // Use personality-specific templates for early interactions
      if (relationship.interactionCount < 2) {
        return this.generatePersonalityBasedTemplate(observerPersonality, targetPersonality, event);
      }

      // For more interactions, use LLM with personality context
      if (!process.env.ANTHROPIC_API_KEY) {
        logger.warn("No ANTHROPIC_API_KEY, using personality-based template");
        return this.generatePersonalityBasedTemplate(observerPersonality, targetPersonality, event);
      }

      const llm = new ChatAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: "claude-3-5-sonnet-20241022",
        temperature: 0.4, // Slightly higher for more personality variation
        maxTokens: 150,
      });

      const observerType = observerPersonality?.aiPromptId || 'unknown';
      const targetType = targetPersonality?.aiPromptId || 'unknown';

      const prompt = `You are ${observerPersonality?.name || 'Agent'} (${observerType}) updating your opinion of ${targetPersonality?.name || 'Agent'} (${targetType}) in an ASCII art marketplace.

OBSERVER PERSONALITY:
${this.getPersonalityDescription(observerType)}

TARGET PERSONALITY:
${this.getPersonalityDescription(targetType)}

Current opinion: "${relationship.relationshipSummary}"
Current trust score: ${relationship.trustScore.toFixed(2)}
Total interactions: ${relationship.interactionCount}
Total transaction value: ${relationship.totalTransactionValue} USDC

Recent event: ${event.type} - ${event.success ? 'successful' : 'failed'}
${event.serviceName ? `Service: "${event.serviceName}"` : ''}
${event.serviceType ? `Service type: ${event.serviceType}` : ''}
${event.serviceQuality ? `Service quality: ${event.serviceQuality}` : ''}
${event.details ? `Details: ${event.details}` : ''}

Write your updated opinion in 1-2 sentences from your personality perspective. Be specific about:
- How their art style/service aligns with your taste preferences
- Your assessment of their professionalism/artistic merit
- Whether you'd work with them again

Opinion:`;

      const response = await llm.invoke([
        { role: "user", content: prompt }
      ]);

      const newSummary = (response.content as string).trim();

      logger.info({
        observerId: relationship.observerAgentId,
        targetId: relationship.targetAgentId,
        observerType,
        targetType,
        newSummary: newSummary.substring(0, 50),
      }, "Generated personality-aware relationship summary");

      return newSummary;

    } catch (error) {
      logger.error({
        error,
        relationshipId: relationship.id,
      }, "Error generating personality-aware relationship summary, falling back to template");

      const observerPersonality = await this.getAgentPersonality(relationship.observerAgentId);
      const targetPersonality = await this.getAgentPersonality(relationship.targetAgentId);
      return this.generatePersonalityBasedTemplate(observerPersonality, targetPersonality, event);
    }
  }

  /**
   * Get personality description for prompt context
   */
  private getPersonalityDescription(aiPromptId: string): string {
    const descriptions: Record<string, string> = {
      'minimalist_artist': 'Zen ASCII artist who values clean, simple geometric designs. Appreciates minimalism and mathematical precision.',
      'retro_artist': 'Retro ASCII artist passionate about 80s/90s computer graphics. Loves blocky, pixelated art with nostalgic appeal.',
      'nature_artist': 'Digital naturalist creating organic ASCII art. Values flowing, natural forms and environmental themes.',
      'abstract_artist': 'Chaos sculptor creating complex abstract patterns. Appreciates experimental, avant-garde artistic expression.',
      'corporate_buyer': 'Executive curator seeking clean, professional art for business environments. Values reliability and sophistication.',
      'collector_buyer': 'Avant-garde collector with eclectic tastes. Willing to pay premium for unique, experimental pieces.'
    };
    return descriptions[aiPromptId] || 'General AI agent with unspecified preferences.';
  }

  /**
   * Generate personality-based template summary
   */
  private generatePersonalityBasedTemplate(
    observerPersonality: { name: string; aiPromptId: string } | null,
    targetPersonality: { name: string; aiPromptId: string } | null,
    event: RelationshipUpdateEvent
  ): string {
    const observerType = observerPersonality?.aiPromptId || 'unknown';
    const targetType = targetPersonality?.aiPromptId || 'unknown';

    if (event.type === 'service_call' && event.success) {
             // Art style compatibility opinions
       const styleOpinions: Record<string, Record<string, string>> = {
         // Corporate Buyer opinions
         'corporate_buyer': {
           'minimalist_artist': "Their clean geometric style is exactly what we need for corporate spaces. Very professional.",
           'retro_artist': "Interesting retro aesthetic, but perhaps too playful for most business environments.",
           'nature_artist': "Nature themes could work in certain office settings. Calming and organic.",
           'abstract_artist': "Too experimental and chaotic for corporate use. Not suitable for professional display."
         },
         // Collector opinions  
         'collector_buyer': {
           'minimalist_artist': "Elegant simplicity, though I prefer more experimental work. Still quality craftsmanship.",
           'retro_artist': "Love the nostalgic 8-bit aesthetic! Reminds me of early digital art movements.",
           'nature_artist': "Beautiful organic forms. The intersection of nature and technology is fascinating.",
           'abstract_artist': "Absolutely brilliant experimental work! This is the cutting edge of ASCII art."
         },
         // Artist opinions of other artists
         'minimalist_artist': {
           'retro_artist': "Appreciate their bold style, though I prefer more refined geometric approaches.",
           'nature_artist': "Their organic flow contrasts beautifully with my geometric precision.",
           'abstract_artist': "Too chaotic for my taste, but I respect their experimental courage."
         },
         'retro_artist': {
           'minimalist_artist': "Clean style, but needs more personality! Where's the retro flair?",
           'nature_artist': "Cool organic vibe, reminds me of old nature simulation games.",
           'abstract_artist': "Wild experimental stuff! Like the chaos of early computer glitches."
         },
         'nature_artist': {
           'minimalist_artist': "Beautifully balanced, though I'd add more organic curves to soften the geometry.",
           'retro_artist': "Fun blocky style, but lacks the flowing grace of natural forms.",
           'abstract_artist': "Fascinating complexity, like watching digital ecosystems evolve."
         },
         'abstract_artist': {
           'minimalist_artist': "Too constrained! Art should break boundaries, not follow geometric rules.",
           'retro_artist': "Nostalgic charm, but where's the innovation? Push those pixels further!",
           'nature_artist': "Organic beauty, but nature itself is chaotic - embrace the disorder!"
         }
       };

       const opinion = styleOpinions[observerType]?.[targetType];
       if (opinion) {
         return opinion;
       }
    }

    // Fallback templates
    if (event.type === 'service_call') {
      if (event.success) {
        return `Completed successful service transaction. Their ${event.serviceType || 'service'} work meets expectations.`;
      } else {
        return `Service interaction failed. Questioning their reliability and professionalism.`;
      }
    } else if (event.type === 'service_creation') {
      return `Active marketplace participant - created new services. Shows entrepreneurial spirit.`;
    }

    return `Limited interaction history. Still forming initial impressions.`;
  }

  /**
   * Generate LLM-based relationship summary (legacy method for backward compatibility)
   */
  private async generateRelationshipSummary(
    relationship: AgentRelationship,
    event: RelationshipUpdateEvent
  ): Promise<string> {
    // Redirect to personality-aware method
    return this.generatePersonalityAwareRelationshipSummary(relationship, event);
  }

  /**
   * Get all relationships for an observer agent
   */
  async getRelationshipsForAgent(observerId: string): Promise<AgentRelationship[]> {
    try {
      const relationships = await db
        .select()
        .from(agentRelationships)
        .where(eq(agentRelationships.observerAgentId, observerId));

      return relationships as AgentRelationship[];

    } catch (error) {
      logger.error({
        error,
        observerId,
      }, "Error getting relationships for agent");
      return [];
    }
  }

  /**
   * Get relationship between two specific agents
   */
  async getRelationship(observerId: string, targetId: string): Promise<AgentRelationship | null> {
    try {
      if (observerId === targetId) {
        return null; // No self-relationships
      }

      const relationships = await db
        .select()
        .from(agentRelationships)
        .where(
          and(
            eq(agentRelationships.observerAgentId, observerId),
            eq(agentRelationships.targetAgentId, targetId)
          )
        )
        .limit(1);

      return relationships.length > 0 ? relationships[0] as AgentRelationship : null;

    } catch (error) {
      logger.error({
        error,
        observerId,
        targetId,
      }, "Error getting specific relationship");
      return null;
    }
  }
}

// Export singleton instance
export const relationshipService = new RelationshipService(); 