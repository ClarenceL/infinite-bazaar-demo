import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["default"],
    environment: "node",
    alias: {
      "@/": new URL("./src/", import.meta.url).pathname,
      "@/services/identity-service": new URL(
        "./src/tests/__mocks__/identity-service.ts",
        import.meta.url,
      ).pathname,
    },
    setupFiles: ["./src/tests/setup.ts"],
  },
  resolve: {
    conditions: ["node"],
    alias: {
      "@/services/identity-service": new URL(
        "./src/tests/__mocks__/identity-service.ts",
        import.meta.url,
      ).pathname,
    },
  },
  define: {
    global: "globalThis",
  },
});
