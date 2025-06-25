import type { Context, Next } from "hono";

/**
 * Auth middleware that requires X-Auth-Key header to match OPUS_NITRO_AUTH_KEY environment variable
 */
export const authMiddleware = () => {
  return async (c: Context, next: Next) => {
    const authKey = process.env.OPUS_NITRO_AUTH_KEY;

    if (!authKey) {
      console.warn("[AUTH] OPUS_NITRO_AUTH_KEY environment variable is not set");
      return c.json({ message: "Server configuration error" }, 500);
    }

    const providedKey = c.req.header("X-Auth-Key");

    if (!providedKey) {
      return c.json({ message: "X-Auth-Key header is required" }, 401);
    }

    if (providedKey !== authKey) {
      return c.json({ message: "Invalid authentication key" }, 403);
    }

    await next();
  };
};
