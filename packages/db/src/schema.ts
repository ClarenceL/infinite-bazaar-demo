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
  cdp_address: varchar("cdp_address", { length: 42 }),
  ...lifecycleDates,
}).enableRLS();
