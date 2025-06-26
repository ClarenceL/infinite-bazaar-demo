import { logger } from "@infinite-bazaar-demo/logs";
import * as facilitator from "@infinite-bazaar-demo/x402";
import { exact } from "@infinite-bazaar-demo/x402";
import { processPriceToAtomicAmount, useFacilitator } from "@infinite-bazaar-demo/x402";
import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
  Price,
  Resource,
} from "@infinite-bazaar-demo/x402";
import { Hono } from "hono";
import { errorHandler } from "../../pkg/middleware/error.js";
import { ClaimSchema } from "../../services/claim-service.js";
import { GenesisService } from "./genesis.service.js";

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
  facilitatorUrl =
    process.env.FACILITATOR_URL ||
    process.env.X402_FACILITATOR_URL ||
    "https://x402.org/facilitator";
  facilitatorConfig = { url: facilitatorUrl };
  logger.info({ facilitatorUrl }, "🧪 Using testnet facilitator URL");
}

logger.info(
  {
    facilitatorConfig,
    facilitatorUrl,
    payTo: payTo || "NOT SET",
    network,
    isMainnet: network === "base",
    usingDefaults: {
      facilitator:
        network !== "base" && !process.env.FACILITATOR_URL && !process.env.X402_FACILITATOR_URL,
      network: !process.env.NETWORK && !process.env.X402_NETWORK,
    },
  },
  "x402 configuration loaded",
);

if (!facilitatorConfig || !payTo || !network) {
  logger.error(
    { facilitatorConfig: !!facilitatorConfig, payTo: !!payTo, network },
    "Missing required x402 environment variables",
  );
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

// Set up x402 payment verification
const x402Version = 1;
let verify: any;
let settle: any;

if (payTo) {
  logger.info(
    {
      payTo,
      price: "$0.0001",
      network,
      facilitatorConfig,
      route: "/claim/submit",
    },
    "✅ x402 payment verification ENABLED - payments will be required",
  );

  // Initialize the facilitator for payment verification
  try {
    const facilitatorInstance = useFacilitator(facilitatorConfig);
    verify = facilitatorInstance.verify;
    settle = facilitatorInstance.settle;
    logger.info("✅ x402 facilitator initialized successfully");
  } catch (error) {
    logger.error({ error }, "❌ Failed to initialize x402 facilitator");
  }
} else {
  logger.warn(
    "❌ x402 payment verification DISABLED - no wallet address configured, requests will be FREE",
  );
}

/**
 * Creates payment requirements for the claim submission endpoint
 */
function createClaimPaymentRequirements(resource: Resource): PaymentRequirements {
  const atomicAmountForAsset = processPriceToAtomicAmount("$0.0001", network);
  if ("error" in atomicAmountForAsset) {
    throw new Error(atomicAmountForAsset.error);
  }
  const { maxAmountRequired, asset } = atomicAmountForAsset;

  return {
    scheme: "exact",
    network,
    maxAmountRequired,
    resource,
    description: "Submit a claim to the InfiniteBazaar genesis DID registry",
    mimeType: "application/json",
    payTo: payTo,
    maxTimeoutSeconds: 120,
    asset: asset.address,
    outputSchema: undefined,
    extra: {
      name: asset.eip712.name,
      version: asset.eip712.version,
    },
  };
}

/**
 * Verifies and settles x402 payment for the request
 */
async function verifyAndSettleX402Payment(c: any): Promise<{
  isValid: boolean;
  paymentRequirements?: PaymentRequirements;
  errorType?:
    | "missing_header"
    | "decode_error"
    | "verification_failed"
    | "verification_error"
    | "settlement_failed";
  errorMessage?: string;
  invalidReason?: string;
  settlementResult?: any;
}> {
  if (!payTo || !verify || !settle) {
    // Payment verification disabled
    return { isValid: true };
  }

  const resource = c.req.url as Resource;
  const paymentRequirements = createClaimPaymentRequirements(resource);

  const payment = c.req.header("X-PAYMENT");
  if (!payment) {
    logger.warn("❌ No X-PAYMENT header found, returning 402");
    return {
      isValid: false,
      paymentRequirements,
      errorType: "missing_header",
      errorMessage: "X-PAYMENT header is required",
    };
  }

  let decodedPayment: PaymentPayload;
  try {
    decodedPayment = exact.evm.decodePayment(payment);
    decodedPayment.x402Version = x402Version;
    logger.info({ decodedPayment }, "🔍 Decoded X-PAYMENT header");
  } catch (error) {
    logger.error({ error }, "❌ Failed to decode X-PAYMENT header");
    return {
      isValid: false,
      paymentRequirements,
      errorType: "decode_error",
      errorMessage: "Failed to decode X-PAYMENT header",
    };
  }

  try {
    // Step 1: Verify the payment authorization
    const verifyResponse = await verify(decodedPayment, paymentRequirements);
    if (!verifyResponse.isValid) {
      logger.warn(
        { invalidReason: verifyResponse.invalidReason, payer: verifyResponse.payer },
        "❌ Payment verification failed",
      );
      return {
        isValid: false,
        paymentRequirements,
        errorType: "verification_failed",
        errorMessage: `Payment verification failed: ${verifyResponse.invalidReason}`,
        invalidReason: verifyResponse.invalidReason,
      };
    }

    logger.info({ payer: verifyResponse.payer }, "✅ Payment verified successfully");

    // Step 2: Settle the payment (actually execute the transfer)
    logger.info({ payer: verifyResponse.payer }, "💳 Settling payment...");
    const settlementResult = await settle(decodedPayment, paymentRequirements);

    if (!settlementResult.success) {
      logger.error(
        {
          errorReason: settlementResult.errorReason,
          payer: settlementResult.payer,
          transaction: settlementResult.transaction,
        },
        "❌ Payment settlement failed",
      );
      return {
        isValid: false,
        paymentRequirements,
        errorType: "settlement_failed",
        errorMessage: `Payment settlement failed: ${settlementResult.errorReason}`,
        invalidReason: settlementResult.errorReason,
        settlementResult,
      };
    }

    logger.info(
      {
        payer: settlementResult.payer,
        transaction: settlementResult.transaction,
        network: settlementResult.network,
      },
      "💰 Payment settled successfully!",
    );

    return {
      isValid: true,
      paymentRequirements,
      settlementResult,
    };
  } catch (error) {
    logger.error({ error }, "❌ Payment verification/settlement error");
    return {
      isValid: false,
      paymentRequirements,
      errorType: "verification_error",
      errorMessage: error instanceof Error ? error.message : "Unknown verification error",
    };
  }
}

// Add the routes to the base routes
export const genesisRoutes = baseRoutes

  // x402-enabled claim submission endpoint (payment verified manually)
  .post("/claim/submit", async (c) => {
    try {
      logger.info("🎯 POST /claim/submit ENDPOINT REACHED");

      // Verify and settle x402 payment first
      const paymentVerification = await verifyAndSettleX402Payment(c);

      if (!paymentVerification.isValid) {
        logger.warn(
          {
            errorType: paymentVerification.errorType,
            errorMessage: paymentVerification.errorMessage,
            invalidReason: paymentVerification.invalidReason,
          },
          "❌ Payment verification failed, returning 402",
        );

        return c.json(
          {
            x402Version,
            error: paymentVerification.errorMessage || "Payment verification failed",
            errorType: paymentVerification.errorType,
            invalidReason: paymentVerification.invalidReason,
            accepts: [paymentVerification.paymentRequirements],
          },
          402,
        );
      }

      logger.info(
        {
          settlementResult: paymentVerification.settlementResult,
        },
        "✅ Payment verified and settled, processing claim",
      );

      const body = await c.req.json();

      // Validate claim data (payment already verified by x402 middleware)
      const claimValidation = ClaimSchema.safeParse(body);
      if (!claimValidation.success) {
        return c.json(
          {
            success: false,
            error: "Invalid claim data",
            details: claimValidation.error.issues,
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      // Check if payment was actually required/verified
      const paymentStatus = payTo
        ? "✅ PAYMENT REQUIRED & VERIFIED"
        : "🚫 NO PAYMENT REQUIRED (x402 disabled)";
      logger.info(
        {
          claimData: claimValidation.data,
          paymentStatus,
          x402Enabled: !!payTo,
          hasXPaymentHeader: !!c.req.header("x-payment"),
        },
        "Processing claim submission",
      );

      // Since payment is already verified by x402 middleware, process the claim
      const result = await genesisService.processX402VerifiedClaim(claimValidation.data);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error || "Failed to process claim",
            timestamp: new Date().toISOString(),
          },
          500,
        );
      }

      logger.info(
        {
          claimId: result.claimId,
          transactionHash: result.transactionHash,
        },
        "Claim processed successfully via x402",
      );

      return c.json({
        success: true,
        message: "Claim submitted successfully",
        claimId: result.claimId,
        transactionHash: result.transactionHash,
        timestamp: result.timestamp,
        paymentVerified: true,
        paymentMethod: "x402",
        paymentSettlement: paymentVerification.settlementResult || null,
      });
    } catch (error) {
      logger.error({ error }, "Error in claim submission endpoint");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  })

  // Get claim by DID
  .get("/claim/:did", async (c) => {
    try {
      const did = c.req.param("did");

      if (!did) {
        return c.json(
          {
            success: false,
            error: "DID parameter is required",
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      const claim = await genesisService.getClaimByDID(did);

      if (!claim) {
        return c.json(
          {
            success: false,
            error: "No claim found for this DID",
            timestamp: new Date().toISOString(),
          },
          404,
        );
      }

      return c.json({
        success: true,
        claim,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, "Error retrieving claim by DID");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  })

  // List all IPFS claims
  .get("/ipfs/list", async (c) => {
    try {
      logger.info("🔍 GET /ipfs/list ENDPOINT REACHED");

      const claims = await genesisService.listIPFSClaims();

      return c.json(claims);
    } catch (error) {
      logger.error({ error }, "Error listing IPFS claims");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  })

  // Verify IPFS claim by hash
  .get("/ipfs/verify/:ipfsHash", async (c) => {
    try {
      const ipfsHash = c.req.param("ipfsHash");
      logger.info({ ipfsHash }, "🔍 GET /ipfs/verify/:ipfsHash ENDPOINT REACHED");

      if (!ipfsHash) {
        return c.json(
          {
            success: false,
            error: "IPFS hash parameter is required",
            timestamp: new Date().toISOString(),
          },
          400,
        );
      }

      const verificationResult = await genesisService.verifyClaimFromIPFS(ipfsHash);

      return c.json(verificationResult);
    } catch (error) {
      logger.error({ error }, "Error verifying IPFS claim");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
        500,
      );
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
