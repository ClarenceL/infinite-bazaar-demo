#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { join } from "node:path";

const projectRoot = join(__dirname, "../../");

console.log("🧪 Running cron service tests...\n");

const result = spawnSync("npx", ["vitest", "run"], {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "test",
  },
});

process.exit(result.status || 0);
