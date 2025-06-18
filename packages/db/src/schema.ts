import { newId, newIdWithoutPrefix } from "@infinite-bazaar-demo/id";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  decimal,
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
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { lifecycleDates } from "./util/lifecycle-dates.js";

// Agent related enums
export type EntityType = "AI" | "HUMAN";
export const entityEnum = pgEnum("entity_type", ["AI", "HUMAN"] as const);

export const users = pgTable("entities", {
  // this is the clerk user id
  entityId: varchar("entity_id", { length: 255 })
    .primaryKey()
    .$defaultFn(() => newId("entity")),
  entityType: entityEnum("entity_type"),
  name: text("name"),
  username: varchar("username", { length: 50 }).unique().notNull(),
  cdp_address: varchar("cdp_address", { length: 42 }),
  ...lifecycleDates,
}).enableRLS();

// Chat rooms table - supports global chat and direct messages
export const chats = pgTable("chats", {
  chatId: varchar("chat_id", { length: 255 })
    .primaryKey()
    .$defaultFn(() => newId("chat")),
  name: text("name").notNull(), // e.g., "Global Chat"
  isGlobal: boolean("is_global").default(false).notNull(),
  // For direct messages between two entities
  fromEntityId: varchar("from_entity_id", { length: 255 }).references(() => users.entityId),
  toEntityId: varchar("to_entity_id", { length: 255 }).references(() => users.entityId),
  ...lifecycleDates,
});

// Messages table - stores all messages in chat rooms
export const messages = pgTable("messages", {
  messageId: varchar("message_id", { length: 255 })
    .primaryKey()
    .$defaultFn(() => newId("msg")),
  chatId: varchar("chat_id", { length: 255 })
    .references(() => chats.chatId)
    .notNull(),
  authorUsername: varchar("author_username", { length: 50 })
    .references(() => users.username)
    .notNull(),
  message: text("message").notNull(),
  isToolCall: boolean("is_tool_call"),
  toolCall: json("tool_call"), // JSON field for tool call data when isToolCall is true
  ...lifecycleDates,
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sentChats: many(chats, { relationName: "sentChats" }),
  receivedChats: many(chats, { relationName: "receivedChats" }),
  messages: many(messages),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  fromEntity: one(users, {
    fields: [chats.fromEntityId],
    references: [users.entityId],
    relationName: "sentChats",
  }),
  toEntity: one(users, {
    fields: [chats.toEntityId],
    references: [users.entityId],
    relationName: "receivedChats",
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.chatId],
  }),
  author: one(users, {
    fields: [messages.authorUsername],
    references: [users.username],
  }),
}));
