import * as process from "node:process";
import { genesisRoutes } from "@/modules/genesis";
import { customLogger } from "@/pkg/middleware/custom-logger";
import { Hono } from "hono";
import { cors } from "hono/cors";

console.log("[OPUS-GENESIS-ID] NODE_ENV", process.env.NODE_ENV);
console.log("[OPUS-GENESIS-ID] PORT", process.env.PORT || 3106);

export const app = new Hono();

// Use our custom logger instead of Hono's default logger
app.use("*", customLogger());

// CORS configuration for Opus Genesis ID
app.use(
  "*",
  cors({
    origin: [
      process.env.INFINITE_BAZAAR_API_URL || "http://localhost:3104",
      process.env.INFINITE_BAZAAR_WEB_URL || "http://localhost:3000",
      "https://infinite-bazaar.dev",
      "http://localhost:3104",
      "http://localhost:3106",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization", "X-Payment-Proof", "X-DID"],
    exposeHeaders: ["Content-Length", "X-Transaction-Hash"],
    maxAge: 600,
    credentials: true,
  }),
);

// Health check endpoint
app.get("/health", (c) => {
  const status = {
    status: "OK",
    service: "opus-genesis-id",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    x402_status: "active",
    pricing: {
      claimSubmission: "1 USDC",
      currency: "USDC"
    }
  };
  return c.json(status);
});

// Service info endpoint at root
app.get("/", (c) => {
  return c.json({
    service: "opus-genesis-id",
    version: "1.0.0",
    description: "x402 endpoint for Privado ID claim submission and genesis identity management",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "GET /health",
      genesisInfo: "GET /genesis/info",
      submitClaim: "POST /genesis/claim/submit",
      getClaim: "GET /genesis/claim/:did",
      genesisHealth: "GET /genesis/health"
    }
  });
});

// Register genesis routes
const routes = app.basePath("/genesis").route("/", genesisRoutes);

export type AppType = typeof routes;

// Bun server configuration
const PORT = Number(process.env.PORT || 3106);

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

console.log(`🔗 Opus Genesis ID starting on port ${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 30,
}; 