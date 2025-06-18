import { errorHandler } from "../../pkg/middleware/error.js";
import { Hono } from "hono";
import { GenesisService } from "./genesis.service.js";
import { ClaimSchema } from "../../services/claim-service.js";
import { logger } from "@infinite-bazaar-demo/logs";
// @ts-ignore
import { paymentMiddleware, Network } from "x402-hono";
// @ts-ignore
import { facilitator } from "@coinbase/x402";

// Create the genesis router
const genesisService = new GenesisService();

// x402 configuration from environment (matching reference pattern)
const payTo = (process.env.ADDRESS || process.env.X402_SERVICE_WALLET_ADDRESS) as `0x${string}`;
const network = (process.env.NETWORK || process.env.X402_NETWORK || "base-sepolia") as Network;

// Determine facilitator based on network
let facilitatorConfig: any;
let facilitatorUrl: string;

if (network === "base") {
  // Use Coinbase mainnet facilitator for base network
  facilitatorConfig = facilitator;
  facilitatorUrl = "coinbase-mainnet-facilitator";
  logger.info("🏦 Using Coinbase mainnet facilitator for base network");
} else {
  // Use testnet facilitator URL for other networks
  facilitatorUrl = process.env.FACILITATOR_URL || process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";
  facilitatorConfig = { url: facilitatorUrl };
  logger.info({ facilitatorUrl }, "🧪 Using testnet facilitator URL");
}

logger.info({
  facilitatorConfig,
  facilitatorUrl,
  payTo: payTo || "NOT SET",
  network,
  isMainnet: network === "base",
  usingDefaults: {
    facilitator: network !== "base" && !process.env.FACILITATOR_URL && !process.env.X402_FACILITATOR_URL,
    network: !process.env.NETWORK && !process.env.X402_NETWORK
  }
}, "x402 configuration loaded");

if (!facilitatorConfig || !payTo || !network) {
  logger.error({ facilitatorConfig: !!facilitatorConfig, payTo: !!payTo, network }, "Missing required x402 environment variables");
}

// Create the base routes
const baseRoutes = new Hono()
  .use("*", errorHandler())

  // Service information endpoint (no payment required)
  .get("/info", async (c) => {
    return c.json({
      service: "InfiniteBazaar Genesis ID Service",
      version: "1.0.0",
      description: "x402-enabled DID claim submission service",
      pricing: {
        claimSubmission: "$0.0001 USDC",
      },
      network,
      facilitator: facilitatorUrl,
      payTo: payTo || "not configured",
      x402Enabled: !!payTo,
    });
  });

// Apply x402 payment middleware to specific routes (like the reference)
if (payTo) {
  logger.info({
    payTo,
    price: "$0.0001",
    network,
    facilitatorConfig,
    route: "/claim/submit"
  }, "✅ x402 payment middleware ENABLED - payments will be required");

  logger.info("🔧 Creating paymentMiddleware with x402-hono...");

  // Test if paymentMiddleware is actually a function
  if (typeof paymentMiddleware !== 'function') {
    logger.error({
      paymentMiddleware: typeof paymentMiddleware,
      isFunction: typeof paymentMiddleware === 'function'
    }, "❌ paymentMiddleware is not a function - x402-hono import failed");
  }

  // Create the payment middleware configuration
  const middlewareConfig = {
    "/claim/submit": {
      price: "$0.0001", // 0.0001 USDC per claim
      network,
      config: {
        description: "Submit a claim to the InfiniteBazaar genesis DID registry",
        mimeType: "application/json",
        maxTimeoutSeconds: 120,
      },
    },
  };

  logger.info({
    payTo,
    middlewareConfig,
    facilitatorConfig
  }, "🔧 x402 middleware configuration");

  // Apply the middleware like in the reference implementation
  baseRoutes.use(
    paymentMiddleware(payTo, middlewareConfig, facilitatorConfig)
  );
} else {
  logger.warn("❌ x402 payment middleware DISABLED - no wallet address configured, requests will be FREE");
}

// Add the routes to the base routes
export const genesisRoutes = baseRoutes

  // x402-enabled claim submission endpoint (payment verified by middleware)
  .post("/claim/submit", async (c) => {
    try {
      logger.info("🎯 POST /claim/submit ENDPOINT REACHED");

      // Log all request headers to see payment information
      const headers: Record<string, string> = {};
      c.req.raw.headers.forEach((value, key) => {
        headers[key] = value;
      });

      logger.info({
        headers,
        url: c.req.url,
        method: c.req.method
      }, "📋 REQUEST DETAILS - checking for payment headers");

      // Look for x402 payment headers specifically
      const paymentHeaders = {
        'x-payment': c.req.header('x-payment'),
        'x-payment-response': c.req.header('x-payment-response'),
        'x-payment-proof': c.req.header('x-payment-proof'),
        'authorization': c.req.header('authorization'),
      };

      logger.info({ paymentHeaders }, "💳 PAYMENT HEADERS CHECK");

      // If we have an X-Payment header, decode and log its contents
      if (paymentHeaders['x-payment']) {
        try {
          // The X-Payment header is typically base64 encoded JSON
          const paymentData = JSON.parse(Buffer.from(paymentHeaders['x-payment'], 'base64').toString());
          logger.info({
            paymentData,
            rawHeader: paymentHeaders['x-payment']
          }, "🔍 X-PAYMENT HEADER DECODED");
        } catch (error) {
          logger.warn({
            error,
            rawHeader: paymentHeaders['x-payment']
          }, "❌ Failed to decode X-Payment header");
        }
      }

      // If we have an X-Payment-Response header, decode it too
      if (paymentHeaders['x-payment-response']) {
        try {
          const responseData = JSON.parse(Buffer.from(paymentHeaders['x-payment-response'], 'base64').toString());
          logger.info({
            responseData,
            rawHeader: paymentHeaders['x-payment-response']
          }, "🔍 X-PAYMENT-RESPONSE HEADER DECODED");
        } catch (error) {
          logger.warn({
            error,
            rawHeader: paymentHeaders['x-payment-response']
          }, "❌ Failed to decode X-Payment-Response header");
        }
      }

      const body = await c.req.json();

      // Validate claim data (payment already verified by x402 middleware)
      const claimValidation = ClaimSchema.safeParse(body);
      if (!claimValidation.success) {
        return c.json({
          success: false,
          error: "Invalid claim data",
          details: claimValidation.error.issues,
          timestamp: new Date().toISOString(),
        }, 400);
      }

      // Check if payment was actually required/verified
      const paymentStatus = payTo ? "✅ PAYMENT REQUIRED & VERIFIED" : "🚫 NO PAYMENT REQUIRED (x402 disabled)";
      logger.info({
        claimData: claimValidation.data,
        paymentStatus,
        x402Enabled: !!payTo,
        hasPaymentHeaders: !!(paymentHeaders['x-payment-response'] || paymentHeaders['x-payment-proof'])
      }, "Processing claim submission");

      // Since payment is already verified by x402 middleware, process the claim
      const result = await genesisService.processX402VerifiedClaim(claimValidation.data);

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error || "Failed to process claim",
          timestamp: new Date().toISOString(),
        }, 500);
      }

      logger.info({
        claimId: result.claimId,
        transactionHash: result.transactionHash
      }, "Claim processed successfully via x402");

      return c.json({
        success: true,
        message: "Claim submitted successfully",
        claimId: result.claimId,
        transactionHash: result.transactionHash,
        timestamp: result.timestamp,
        paymentVerified: true,
        paymentMethod: "x402",
      });
    } catch (error) {
      logger.error({ error }, "Error in claim submission endpoint");
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }, 500);
    }
  })

  // Get claim by DID
  .get("/claim/:did", async (c) => {
    try {
      const did = c.req.param("did");

      if (!did) {
        return c.json({
          success: false,
          error: "DID parameter is required",
          timestamp: new Date().toISOString(),
        }, 400);
      }

      const claim = await genesisService.getClaimByDID(did);

      if (!claim) {
        return c.json({
          success: false,
          error: "No claim found for this DID",
          timestamp: new Date().toISOString(),
        }, 404);
      }

      return c.json({
        success: true,
        claim,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, "Error retrieving claim by DID");
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }, 500);
    }
  })

  // Health check endpoint
  .get("/health", async (c) => {
    return c.json({
      status: "healthy",
      service: "opus-genesis-id",
      timestamp: new Date().toISOString(),
    });
  }); 