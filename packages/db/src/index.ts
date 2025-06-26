// Log DATABASE_URL with masked password for verification
const dbUrl = process.env.DATABASE_URL || "";
const maskedDbUrl = dbUrl.replace(/(postgresql:\/\/)([^:]+):([^@]+)@/, (_, protocol, user) => {
  return `${protocol}${user}:****@`;
});

console.log(`[DB] DATABASE_URL: ${maskedDbUrl}`);

// Export everything from drizzle-orm first
export * from "drizzle-orm";
export { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";

// Export sql directly to avoid type issues
import { sql as drizzleSql } from "drizzle-orm";
export { drizzleSql as sql };

// Utility function for count queries
export function getCount() {
  return { count: drizzleSql<number>`cast(count(*) as integer)` };
}

// Then export schema and types
export * from "./schema.js";
export * from "./types.js";

import { closeConnection, createClient } from "./client.js";
export const db = createClient(process.env.DATABASE_URL!);
// Export the closeConnection function
export { closeConnection };

// Export operators for use in queries
export {
  eq,
  and,
  or,
  not,
  like,
  ilike,
  gt,
  gte,
  lt,
  lte,
  isNull,
  isNotNull,
  inArray,
} from "drizzle-orm";

// Helper function to convert snake_case API params to camelCase for DB
export function snakeToCamel(obj: Record<string, any>): Record<string, any> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }

  return Object.keys(obj).reduce(
    (acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = snakeToCamel(obj[key]);
      return acc;
    },
    {} as Record<string, any>,
  );
}

// Helper function to convert camelCase DB results to snake_case for API
export function camelToSnake(obj: Record<string, any>): Record<string, any> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(camelToSnake);
  }

  return Object.keys(obj).reduce(
    (acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      acc[snakeKey] = camelToSnake(obj[key]);
      return acc;
    },
    {} as Record<string, any>,
  );
}

export {
  entities,
  x402Endpoints,
  x402ServiceCalls,
  entityContext,
  agentRelationships,
} from "./schema.js";
