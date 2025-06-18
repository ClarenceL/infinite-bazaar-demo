import dotenv from "dotenv";

// Load test environment variables
dotenv.config({ path: ".env.test" });

// Set NODE_ENV for tests
process.env.NODE_ENV = "test";
