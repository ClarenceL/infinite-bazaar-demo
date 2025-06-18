import { describe, expect, it } from "vitest";
import { app } from "../index";

describe("Health Endpoint", () => {
  it("should return 200 OK", async () => {
    // Create a test request
    const res = await app.request("/health");

    // Check status code
    expect(res.status).toBe(200);

    // Check response body
    const body = await res.json();

    // Verify response structure
    expect(body).toHaveProperty("status", "OK");
    // expect(body).toHaveProperty("timestamp");
    // expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("environment");
  });
});
