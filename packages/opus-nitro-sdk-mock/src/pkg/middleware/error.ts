import { logger } from "@infinite-bazaar-demo/logs";
import type { MiddlewareHandler } from "hono";

// Changed to a factory function for consistency
export const errorHandler = (): MiddlewareHandler => {
  return async (c, next) => {
    try {
      await next();
    } catch (error) {
      logger.error({ error, service: "opus-nitro-sdk-mock" }, "Error in opus-nitro-sdk-mock");

      if (error instanceof Error) {
        return c.json(
          {
            success: false,
            message: error.message,
            service: "opus-nitro-sdk-mock",
          },
          error.name === "ValidationError" ? 400 : 500,
        );
      }

      return c.json(
        {
          success: false,
          message: "Internal Server Error",
          service: "opus-nitro-sdk-mock",
        },
        500,
      );
    }
  };
}; 