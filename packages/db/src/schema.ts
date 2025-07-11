import { newId, newIdWithoutPrefix } from "@infinite-bazaar-demo/id";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  json,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { lifecycleDates } from "./util/lifecycle-dates.js";

// Agent related enums
export type EntityType = "AI" | "HUMAN";
export const entityEnum = pgEnum("entity_type", ["AI", "HUMAN"] as const);

// Context type enum for entity context messages
export type ContextType = "MESSAGE" | "TOOL_USE" | "TOOL_RESULT";
export const contextTypeEnum = pgEnum("context_type", [
  "MESSAGE",
  "TOOL_USE",
  "TOOL_RESULT",
] as const);

export const entities = pgTable("entities", {
  entityId: varchar("entity_id", { length: 255 })
    .primaryKey()
    .$defaultFn(() => newId("entity")),
  instanceId: varchar("instance_id", { length: 255 }).notNull(),
  entityType: entityEnum("entity_type"),
  name: text("name"),
  // this is the name humans give, but it's never passed to the agent
  // instead they choose their own "name", and the cdp_name is hardcoded or deterministic based on the name
  cdp_name: varchar("cdp_name", { length: 255 }),
  cdp_address: varchar("cdp_address", { length: 44 }),
  iden3_key_id: varchar("iden3_key_id", { length: 255 }),
  ai_prompt_id: varchar("ai_prompt_id", { length: 255 }), // Maps to AI prompt templates
  anthropic_model: varchar("anthropic_model", { length: 255 }), // Anthropic model to use for this entity
  active: boolean("active").default(true).notNull(),
  chat_order: integer("chat_order").default(999).notNull(), // Order for processing in cron job (lower = earlier)
  lastQueryTime: timestamp("last_query_time", { withTimezone: true }), // Track when entity last queried for new messages
  ...lifecycleDates,
}, (table) => ({
  instanceIdx: index("entities_instance_idx").on(table.instanceId),
  cdpNameInstanceUnique: unique("entities_cdp_name_instance_unique").on(table.instanceId, table.cdp_name),
})).enableRLS();

// Chat rooms table - supports global chat and direct messages
export const chats = pgTable("chats", {
  chatId: varchar("chat_id", { length: 255 })
    .primaryKey()
    .$defaultFn(() => newId("chat")),
  instanceId: varchar("instance_id", { length: 255 }).notNull(),
  name: text("name").notNull(), // e.g., "Global Chat"
  isGlobal: boolean("is_global").default(false).notNull(),
  // For direct messages between two entities
  fromEntityId: varchar("from_entity_id", { length: 255 }).references(() => entities.entityId),
  toEntityId: varchar("to_entity_id", { length: 255 }).references(() => entities.entityId),
  ...lifecycleDates,
}, (table) => ({
  instanceIdx: index("chats_instance_idx").on(table.instanceId),
})).enableRLS();

// Entity context table - tracks LLM messages from agents, optionally scoped to a chat
export const entityContext = pgTable(
  "entity_context",
  {
    contextId: varchar("context_id", { length: 255 })
      .primaryKey()
      .$defaultFn(() => newId("context")),
    instanceId: varchar("instance_id", { length: 255 }).notNull(),
    entityId: varchar("entity_id", { length: 255 })
      .references(() => entities.entityId)
      .notNull(),
    role: text("role").notNull(), // "user", "assistant", "system", etc.
    content: text("content").notNull(), // The message content
    sequence: integer("sequence").notNull(), // Order of messages, in case of timestamp collisions
    contextType: contextTypeEnum("context_type").default("MESSAGE").notNull(),
    // Tool use fields - populated when contextType is TOOL_USE
    toolName: text("tool_name"), // e.g., "search_asset"
    toolId: text("tool_id"), // e.g., "toolu_016QBK1L5KwfeC5wrPJ3Kaxr"
    toolUseId: text("tool_use_id"), // e.g., "tool-1749154277791-jsxro"
    toolInput: json("tool_input"), // The input parameters as JSON
    // Tool result fields - populated when contextType is TOOL_RESULT
    toolResultData: json("tool_result_data"), // The data field from tool results
    chatId: varchar("chat_id", { length: 255 }).references(() => chats.chatId), // Optional chat scoping
    // Real-time streaming sync field - null during streaming, timestamp when complete
    completedAt: timestamp("completed_at", { withTimezone: true }), // null = streaming, timestamp = done
    ...lifecycleDates,
  },
  (table) => ({
    // Composite index for efficient sequence queries per entity
    entitySequenceIdx: uniqueIndex("entity_context_entity_sequence_idx").on(
      table.entityId,
      table.sequence,
    ),
    // Index for efficient querying by completion status
    completedAtIdx: index("entity_context_completed_at_idx").on(table.completedAt),
    // Index for efficient instance-scoped queries
    instanceIdx: index("entity_context_instance_idx").on(table.instanceId),
  }),
).enableRLS();

// Relations
export const entitiesRelations = relations(entities, ({ many }) => ({
  sentChats: many(chats, { relationName: "sentChats" }),
  receivedChats: many(chats, { relationName: "receivedChats" }),
  entityContexts: many(entityContext),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  fromEntity: one(entities, {
    fields: [chats.fromEntityId],
    references: [entities.entityId],
    relationName: "sentChats",
  }),
  toEntity: one(entities, {
    fields: [chats.toEntityId],
    references: [entities.entityId],
    relationName: "receivedChats",
  }),
  entityContexts: many(entityContext),
}));

export const entityContextRelations = relations(entityContext, ({ one }) => ({
  entity: one(entities, {
    fields: [entityContext.entityId],
    references: [entities.entityId],
  }),
  chat: one(chats, {
    fields: [entityContext.chatId],
    references: [chats.chatId],
  }),
}));

// x402 Service Endpoints - for dynamic agent-created services
export const x402Endpoints = pgTable("x402_endpoints", {
  endpointId: varchar("endpoint_id", { length: 255 })
    .primaryKey()
    .$defaultFn(() => newId("endpoint")),
  instanceId: varchar("instance_id", { length: 255 }).notNull(),
  agentId: varchar("agent_id", { length: 255 })
    .references(() => entities.entityId)
    .notNull(),
  serviceName: text("service_name").notNull(),
  description: text("description").notNull(),
  serviceType: text("service_type").default("analysis").notNull(), // e.g., "analysis", "creative", "api", "computation"
  route: text("route").notNull(), // e.g., "/service/:agentId/analyze"
  price: decimal("price", { precision: 10, scale: 6 }).notNull(), // USDC price
  priceDescription: text("price_description"), // e.g., "per analysis", "per minute"
  logic: text("logic").notNull(), // Serialized function/script logic
  systemPrompt: text("system_prompt"), // Custom system prompt for LLM-based services
  active: boolean("active").default(true).notNull(),
  totalCalls: integer("total_calls").default(0).notNull(),
  totalRevenue: decimal("total_revenue", { precision: 18, scale: 6 }).default("0").notNull(),
  ...lifecycleDates,
}, (table) => ({
  instanceIdx: index("x402_endpoints_instance_idx").on(table.instanceId),
})).enableRLS();

// x402 Service Calls - track usage and payments
export const x402ServiceCalls = pgTable("x402_service_calls", {
  callId: varchar("call_id", { length: 255 })
    .primaryKey()
    .$defaultFn(() => newId("call")),
  instanceId: varchar("instance_id", { length: 255 }).notNull(),
  endpointId: varchar("endpoint_id", { length: 255 })
    .references(() => x402Endpoints.endpointId)
    .notNull(),
  callerAgentId: varchar("caller_agent_id", { length: 255 })
    .references(() => entities.entityId)
    .notNull(),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 6 }).notNull(),
  paymentHash: text("payment_hash"), // x402 payment transaction hash
  requestData: json("request_data"), // Input parameters
  responseData: json("response_data"), // Service output
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  ...lifecycleDates,
}, (table) => ({
  instanceIdx: index("x402_service_calls_instance_idx").on(table.instanceId),
})).enableRLS();

// Relations for x402 services
export const x402EndpointsRelations = relations(x402Endpoints, ({ one, many }) => ({
  agent: one(entities, {
    fields: [x402Endpoints.agentId],
    references: [entities.entityId],
  }),
  serviceCalls: many(x402ServiceCalls),
}));

export const x402ServiceCallsRelations = relations(x402ServiceCalls, ({ one }) => ({
  endpoint: one(x402Endpoints, {
    fields: [x402ServiceCalls.endpointId],
    references: [x402Endpoints.endpointId],
  }),
  callerAgent: one(entities, {
    fields: [x402ServiceCalls.callerAgentId],
    references: [entities.entityId],
  }),
}));

export const agentRelationships = pgTable("agent_relationships", {
  id: uuid("id").defaultRandom().primaryKey(),
  instanceId: varchar("instance_id", { length: 255 }).notNull(),
  observerAgentId: text("observer_agent_id").notNull(),
  targetAgentId: text("target_agent_id").notNull(),
  relationshipSummary: text("relationship_summary")
    .notNull()
    .default("New agent - no interactions yet"),
  trustScore: real("trust_score").notNull().default(0.5),
  interactionCount: integer("interaction_count").notNull().default(0),
  totalTransactionValue: text("total_transaction_value").notNull().default("0"),
  lastInteractionAt: timestamp("last_interaction_at"),
  ...lifecycleDates,
}, (table) => ({
  instanceIdx: index("agent_relationships_instance_idx").on(table.instanceId),
})).enableRLS();

// Add unique constraint for observer-target pairs within instance
export const agentRelationshipsUniqueConstraint = unique("unique_observer_target_instance").on(
  agentRelationships.instanceId,
  agentRelationships.observerAgentId,
  agentRelationships.targetAgentId,
);

// Context Summaries - for smart token management
export const contextSummaries = pgTable("context_summaries", {
  summaryId: varchar("summary_id", { length: 255 })
    .primaryKey()
    .$defaultFn(() => newId("summary")),
  instanceId: varchar("instance_id", { length: 255 }).notNull(),
  entityId: varchar("entity_id", { length: 255 })
    .references(() => entities.entityId)
    .notNull(),
  summaryText: text("summary_text").notNull(), // The actual summary
  messageCount: integer("message_count").notNull(), // How many messages this summarizes
  lastMessageId: varchar("last_message_id", { length: 255 }), // Last message included in summary
  tokenEstimate: integer("token_estimate"), // Estimated tokens in the summary
  summaryType: text("summary_type").default("conversation").notNull(), // "conversation", "global_activity", etc.
  ...lifecycleDates,
}, (table) => ({
  instanceIdx: index("context_summaries_instance_idx").on(table.instanceId),
  entityIdx: index("context_summaries_entity_idx").on(table.entityId),
  typeIdx: index("context_summaries_type_idx").on(table.summaryType),
})).enableRLS();
