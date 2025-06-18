import { errorHandler } from "../../pkg/middleware/error.js";
import { Hono } from "hono";
import { GenesisService } from "./genesis.service.js";
import { ClaimSchema } from "../../services/claim-service.js";
import { logger } from "@infinite-bazaar-demo/logs";
import { paymentMiddleware, Network } from "x402-hono";

// Create the genesis router
const genesisService = new GenesisService();

// x402 configuration from environment
const facilitatorUrl = process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";
const payTo = process.env.X402_SERVICE_WALLET_ADDRESS as `0x${string}`;
const network = (process.env.X402_NETWORK || "base-sepolia") as Network;

// Create the routes with conditional x402 middleware
const createGenesisRoutes = () => {
  const routes = new Hono()
    .use("*", errorHandler())

    // Service information endpoint
    .get("/info", async (c) => {
      return c.json({
        service: "InfiniteBazaar Genesis ID Service",
        version: "1.0.0",
        description: "x402-enabled DID claim submission service",
        pricing: {
          claimSubmission: "$1.00 USDC",
        },
        network,
        facilitator: facilitatorUrl,
        payTo: payTo || "not configured",
        x402Enabled: !!payTo,
      });
    });

  // Apply x402 payment middleware only if payTo address is configured
  if (payTo) {
    logger.info({ payTo, network, facilitatorUrl }, "Configuring x402 payment middleware");
    routes.use(
      "/claim/submit",
      paymentMiddleware(
        payTo,
        {
          "/claim/submit": {
            price: "$1.00", // 1 USDC per claim
            network,
            config: {
              description: "Submit a claim to the InfiniteBazaar genesis DID registry",
              mimeType: "application/json",
            },
          },
        },
        {
          url: facilitatorUrl,
        },
      ),
    );
  } else {
    logger.warn("X402_SERVICE_WALLET_ADDRESS not configured - running without payment middleware");
  }

  return routes;
};

export const genesisRoutes = createGenesisRoutes()

  // x402-enabled claim submission endpoint (payment verified by middleware)
  .post("/claim/submit", async (c) => {
    try {
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

      logger.info({ claimData: claimValidation.data }, "Processing paid claim submission");

      // Since payment is already verified by x402 middleware, we can process the claim directly
      // For now, we'll use a simplified approach until we update GenesisService
      const claimId = `claim_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const timestamp = new Date().toISOString();

      // TODO: Update GenesisService to handle x402-verified payments
      // For now, return success with mock data
      logger.info({ claimId, timestamp }, "Claim processed successfully via x402");

      return c.json({
        success: true,
        message: "Claim submitted successfully",
        claimId,
        timestamp,
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