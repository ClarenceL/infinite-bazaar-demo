import process from "node:process";
import { customLogger } from "@/pkg/middleware/custom-logger";
import { errorHandler } from "@/pkg/middleware/error";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { chatRoutes } from "./modules/chat/chat.routes.js";
import { relationshipsRoutes } from "./modules/relationships/relationships.routes.js";

console.log("[API] NODE_ENV", process.env.NODE_ENV);
console.log("[API] INFINITE_BAZAAR_API_URL", process.env.INFINITE_BAZAAR_API_URL);

export const app = new Hono();

// Use our custom logger instead of Hono's default logger
app.use("*", customLogger());

// CORS configuration for Infinite Bazaar
app.use(
  "*",
  cors({
    origin: [
      process.env.INFINITE_BAZAAR_WEB_URL || "http://localhost:3000",
      "https://infinite-bazaar.dev",
      "https://infinite-bazaar-demo.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

// Health check endpoint
app.get("/health", (c) => {
  const status = {
    status: "OK",
    service: "infinite-bazaar-api",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  };
  return c.json(status);
});

// API routes with error handler
const routes = app
  .basePath("/api")
  .use("*", errorHandler())
  // Chat routes
  .route("/chat", chatRoutes)
  // Relationships routes
  .route("/relationships", relationshipsRoutes)
  // Add more routes here as they're developed
  .get("/", (c) => {
    return c.json({
      message: "Infinite Bazaar API",
      version: "1.0.0",
      description: "A protocol for secure, scalable AI agent identities using AWS Nitro Enclaves",
    });
  });

export type AppType = typeof routes;

// Bun server configuration
const PORT = Number(process.env.PORT || 3104);

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

console.log(`🚀 Infinite Bazaar API starting on port ${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 30,
};
