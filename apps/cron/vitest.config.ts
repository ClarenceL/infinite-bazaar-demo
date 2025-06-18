import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["default"],
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    alias: {
      "@/": new URL("./src/", import.meta.url).pathname,
    },
    testTimeout: 30000, // 30 seconds for integration tests
  },
});
