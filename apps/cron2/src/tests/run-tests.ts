#!/usr/bin/env bun

import { spawn } from "node:child_process";

const testProcess = spawn("bun", ["vitest"], {
  stdio: "inherit",
  cwd: process.cwd(),
});

testProcess.on("exit", (code) => {
  process.exit(code || 0);
});
