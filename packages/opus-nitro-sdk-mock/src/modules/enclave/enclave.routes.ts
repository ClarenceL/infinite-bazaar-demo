import { errorHandler } from "@/pkg/middleware/error";
import { Hono } from "hono";
import { enclaveService } from "./enclave.service";

// Create the enclave router
export const enclaveRoutes = new Hono()
  .use("*", errorHandler())

  // Mock enclave info endpoint
  .get("/info", async (c) => {
    try {
      const info = await enclaveService.getEnclaveInfo();
      return c.json(info);
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  })

  // Real Privado ID identity creation endpoint
  .post("/identity/create", async (c) => {
    try {
      const result = await enclaveService.createIdentity();

      return c.json({
        success: true,
        identity: {
          did: result.did,
          keyId: result.keyId,
          filePath: result.filePath,
          timestamp: result.timestamp,
        },
        credential: result.credential,
        mock: false, // This is real Privado ID functionality
        message: "Identity created using Privado ID JS SDK",
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        mock: false,
      }, 500);
    }
  })

  // List created identities
  .get("/identity/list", async (c) => {
    try {
      const identities = await enclaveService.listIdentities();

      return c.json({
        success: true,
        identities,
        count: identities.length,
        mock: false,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        mock: false,
      }, 500);
    }
  })

  // Mock DID creation endpoint (legacy)
  .post("/did/create", async (c) => {
    try {
      const body = await c.req.json();
      const result = await enclaveService.createMockDid(body);
      return c.json(result);
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        mock: true,
      }, 500);
    }
  })

  // Mock state signing endpoint
  .post("/state/sign", async (c) => {
    try {
      const body = await c.req.json();
      const result = await enclaveService.signState(body);
      return c.json(result);
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        mock: true,
      }, 500);
    }
  })

  // Mock memory commitment endpoint
  .post("/memory/commit", async (c) => {
    try {
      const body = await c.req.json();
      const result = await enclaveService.commitMemory(body);
      return c.json(result);
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        mock: true,
      }, 500);
    }
  })

  // Mock attestation endpoint
  .get("/attestation", async (c) => {
    try {
      const result = await enclaveService.generateAttestation();
      return c.json(result);
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        mock: true,
      }, 500);
    }
  }); 