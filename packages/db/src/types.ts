import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import * as schema from "./schema.js";

// Re-export these types for easier consumption
export type { InferInsertModel, InferSelectModel };
