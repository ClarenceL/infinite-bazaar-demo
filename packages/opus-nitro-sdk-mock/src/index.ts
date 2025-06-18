import process from "node:process";
import { customLogger } from "@/pkg/middleware/custom-logger";
import { errorHandler } from "@/pkg/middleware/error";
import { Hono } from "hono";
import { cors } from "hono/cors";

console.log("[OPUS-NITRO-SDK-MOCK] NODE_ENV", process.env.NODE_ENV);
console.log("[OPUS-NITRO-SDK-MOCK] PORT", process.env.PORT || 3105);

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

// Mock Nitro Enclave endpoints
const routes = app
  .basePath("/enclave")
  .use("*", errorHandler())

  // Mock enclave info endpoint
  .get("/info", (c) => {
    return c.json({
      enclave_id: "mock-enclave-001",
      pcr0: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      pcr1: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
      pcr2: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      status: "running",
      mock: true,
    });
  })

  // Mock DID creation endpoint
  .post("/did/create", async (c) => {
    const body = await c.req.json();

    // Mock DID creation response
    return c.json({
      success: true,
      did: `did:privado:polygon:main:mock${Date.now()}`,
      state_hash: `0x${Math.random().toString(16).substring(2, 66)}`,
      attestation_document: "mock_attestation_document_base64",
      created_at: new Date().toISOString(),
      mock: true,
    });
  })

  // Mock state signing endpoint
  .post("/state/sign", async (c) => {
    const body = await c.req.json();

    return c.json({
      success: true,
      signature: `0x${Math.random().toString(16).substring(2, 130)}`,
      state_hash: body.state_hash || `0x${Math.random().toString(16).substring(2, 66)}`,
      signed_at: new Date().toISOString(),
      pcr_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      mock: true,
    });
  })

  // Mock memory commitment endpoint
  .post("/memory/commit", async (c) => {
    const body = await c.req.json();

    return c.json({
      success: true,
      commitment_hash: `0x${Math.random().toString(16).substring(2, 66)}`,
      ipfs_cid: `Qm${Math.random().toString(36).substring(2, 48)}`,
      committed_at: new Date().toISOString(),
      memory_size: body.memory?.length || 0,
      mock: true,
    });
  })

  // Mock attestation endpoint
  .get("/attestation", (c) => {
    return c.json({
      attestation_document: "mock_attestation_document_base64_encoded",
      pcr_measurements: {
        pcr0: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        pcr1: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
        pcr2: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      },
      timestamp: new Date().toISOString(),
      nonce: Math.random().toString(36).substring(2),
      mock: true,
    });
  });

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