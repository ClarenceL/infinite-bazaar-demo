import dotenv from "dotenv";
import { afterAll, beforeAll } from "vitest";

// Load test environment variables
dotenv.config({ path: ".env.test" });

beforeAll(async () => {
  // Global test setup
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
});

afterAll(async () => {
  // Global test cleanup
});
