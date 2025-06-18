import * as process from "node:process";
import { enclaveRoutes } from "@/modules/enclave";
import { opusRoutes } from "@/modules/opus";
import { customLogger } from "@/pkg/middleware/custom-logger";
import { Hono } from "hono";
import { cors } from "hono/cors";
import "./environment";

console.log("[OPUS-NITRO-SDK-MOCK] NODE_ENV", process.env.NODE_ENV);
console.log("[OPUS-NITRO-SDK-MOCK] PORT", process.env.PORT || 3105);
console.log(
  "[OPUS-NITRO-SDK-MOCK] ANTHROPIC_API_KEY",
  process.env.ANTHROPIC_API_KEY ? "✅ Set" : "❌ Missing",
);
console.log(
  "[OPUS-NITRO-SDK-MOCK] ANTHROPIC_API_KEY length",
  process.env.ANTHROPIC_API_KEY?.length || 0,
);

export const app = new Hono();

// Use our custom logger instead of Hono's default logger
app.use("*", customLogger());

// CORS configuration for Opus Nitro SDK Mock
app.use(
  "*",
  cors({
    origin: [
      process.env.INFINITE_BAZAAR_API_URL || "http://localhost:3104",
      process.env.INFINITE_BAZAAR_WEB_URL || "http://localhost:3000",
      "https://infinite-bazaar.dev",
      "http://localhost:3104",
      "http://localhost:3105",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization", "X-Enclave-Key", "X-PCR-Hash"],
    exposeHeaders: ["Content-Length", "X-Attestation-Document"],
    maxAge: 600,
    credentials: true,
  }),
);

// Health check endpoint
app.get("/health", (c) => {
  const status = {
    status: "OK",
    service: "opus-nitro-sdk-mock",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    enclave_status: "mocked",
  };
  return c.json(status);
});

// Register enclave routes
const enclaveApp = app.basePath("/enclave").route("/", enclaveRoutes);

// Register Opus agent routes
const opusApp = app.basePath("/opus").route("/", opusRoutes);

const routes = opusApp;

export type AppType = typeof routes;

// Bun server configuration
const PORT = Number(process.env.PORT || 3105);

// Add global error handler for the process
process.on("uncaughtException", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Exiting...`);
    process.exit(1);
  } else {
    console.error("Uncaught exception:", err);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

console.log(`🔒 Opus Nitro SDK Mock starting on port ${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 30,
};
