import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from "@infinite-bazaar-demo/logs";
import { customLogger } from "./pkg/middleware/custom-logger";
import { errorHandler } from "./pkg/middleware/error";
import { genesisRoutes } from "./modules";

const app = new Hono();

// Global middleware
app.use("*", customLogger());
app.use("*", errorHandler());

// Health check endpoint
app.get("/", (c) => {
  return c.json({
    service: "opus-genesis-id",
    version: "0.0.1",
    description: "x402 endpoint for Privado ID claim submission and genesis identity management",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "GET /",
      genesisInfo: "GET /genesis/info",
      submitClaim: "POST /genesis/claim/submit",
      getClaim: "GET /genesis/claim/:did",
      genesisHealth: "GET /genesis/health"
    }
  });
});

// Mount genesis routes
app.route("/genesis", genesisRoutes);

// Start server
const port = Number(process.env.OPUS_GENESIS_ID_PORT) || 3106;

const server = serve({
  fetch: app.fetch,
  port,
});

logger.info({ port }, "🔗 Opus Genesis ID server started");

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down Opus Genesis ID server...");
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down Opus Genesis ID server...");
  server.close();
  process.exit(0);
});

export default app; 