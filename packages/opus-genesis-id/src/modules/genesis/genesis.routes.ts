import { errorHandler } from "@/pkg/middleware/error";
import { Hono } from "hono";
import { GenesisService } from "./genesis.service";
import { ClaimSchema, X402PaymentSchema } from "@/services/claim-service";
import { logger } from "@infinite-bazaar-demo/logs";

// Create the genesis router
const genesisService = new GenesisService();

export const genesisRoutes = new Hono()
  .use("*", errorHandler())

  // Service information endpoint
  .get("/info", async (c) => {
    try {
      const info = await genesisService.getServiceInfo();
      return c.json(info);
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }, 500);
    }
  })

  // x402 endpoint for claim submission
  .post("/claim/submit", async (c) => {
    try {
      const body = await c.req.json();

      // Validate request structure
      if (!body.claim || !body.payment) {
        return c.json({
          success: false,
          error: "Request must include both 'claim' and 'payment' objects",
          timestamp: new Date().toISOString(),
        }, 400);
      }

      // Validate claim data
      const claimValidation = ClaimSchema.safeParse(body.claim);
      if (!claimValidation.success) {
        return c.json({
          success: false,
          error: "Invalid claim data",
          details: claimValidation.error.issues,
          timestamp: new Date().toISOString(),
        }, 400);
      }

      // Validate payment data
      const paymentValidation = X402PaymentSchema.safeParse(body.payment);
      if (!paymentValidation.success) {
        return c.json({
          success: false,
          error: "Invalid payment data",
          details: paymentValidation.error.issues,
          timestamp: new Date().toISOString(),
        }, 400);
      }

      // Process the genesis claim submission
      const result = await genesisService.processGenesisClaimSubmission({
        claim: claimValidation.data,
        payment: paymentValidation.data,
      });

      const statusCode = result.success ? 200 : 400;
      return c.json(result, statusCode);
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