import { logger } from "@infinite-bazaar-demo/logs";
import { Context, Next } from "hono";

export function customLogger() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    const method = c.req.method;
    const url = c.req.url;

    logger.info({ method, url }, "Incoming request to opus-genesis-id");

    await next();

    const end = Date.now();
    const status = c.res.status;
    const duration = end - start;

    logger.info({ method, url, status, duration }, "Request completed");
  };
}
