import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["default"],
    environment: "node",
    alias: {
      "@/": new URL("./src/", import.meta.url).pathname,
    },
    setupFiles: ["./src/tests/setup.ts"],
  },
  resolve: {
    conditions: ["node"],
    alias: {
      // Add any future mock aliases here if needed
    },
  },
  define: {
    global: "globalThis",
  },
});
