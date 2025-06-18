import { logger } from "@infinite-bazaar-demo/logs";
import { Context, Next } from "hono";

export function errorHandler() {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (error) {
      logger.error({ error }, "Request error in opus-genesis-id");

      if (error instanceof Error) {
        return c.json(
          {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          },
          500,
        );
      }

      return c.json(
        {
          success: false,
          error: "Internal server error",
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  };
}
