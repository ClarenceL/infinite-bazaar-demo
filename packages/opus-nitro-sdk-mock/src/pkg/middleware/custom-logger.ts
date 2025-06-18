import { logger } from "@infinite-bazaar-demo/logs";
import type { MiddlewareHandler } from "hono";

/**
 * Sensitive parameter names that should be redacted from logs
 */
const SENSITIVE_PARAMS = [
  "password",
  "token",
  "key",
  "secret",
  "api_key",
  "apikey",
  "accesskey",
  "access_key",
  "private_key",
  "privatekey",
  "wallet",
  "seed",
  "mnemonic",
  "enclave_key",
  "attestation",
  "pcr",
];

/**
 * Custom logger middleware that sanitizes sensitive URL parameters
 * Based on Hono's logger but with added protection for sensitive data
 */
export const customLogger = (): MiddlewareHandler => {
  return async (c, next) => {
    // Record start time
    const start = Date.now();

    // Get original URL and sanitize it
    const originalUrl = c.req.url;
    const sanitizedUrl = sanitizeUrl(originalUrl);

    // Log the incoming request with sanitized URL
    logger.info(
      {
        method: c.req.method,
        path: sanitizedUrl,
        service: "opus-nitro-sdk-mock",
      },
      "<-- Request received",
    );

    // Process the request
    await next();

    // Calculate elapsed time
    const elapsed = Date.now() - start;

    // Log the response with sanitized URL
    logger.info(
      {
        method: c.req.method,
        path: sanitizedUrl,
        status: c.res.status,
        elapsed: `${elapsed}ms`,
        service: "opus-nitro-sdk-mock",
      },
      "--> Response sent",
    );
  };
};

/**
 * Sanitizes a URL by redacting values of sensitive query parameters
 */
function sanitizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    let modified = false;

    // Check each query parameter
    for (const [key, value] of parsedUrl.searchParams.entries()) {
      // Check if the parameter name contains any sensitive keywords
      if (
        SENSITIVE_PARAMS.some((param) => key.toLowerCase().includes(param.toLowerCase())) &&
        value
      ) {
        // Replace the value with asterisks
        parsedUrl.searchParams.set(key, "********");
        modified = true;
      }
    }

    // Return the sanitized URL if modified, otherwise the original URL
    return modified ? parsedUrl.toString() : url;
  } catch (error) {
    // If URL parsing fails, return the original URL
    logger.warn({ error }, "Failed to sanitize URL");
    return url;
  }
} 