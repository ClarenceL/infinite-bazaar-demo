// scripts/log-env.js
const allowList = ["VERCEL_ENV", "NODE_ENV", "NEXT_PUBLIC_MCP_URL", "NEXT_PUBLIC_API_URL"];

const maskedEnv = {};
for (const [key, value] of Object.entries(process.env)) {
  if (allowList.includes(key)) {
    maskedEnv[key] = value;
  } else if (typeof value === "string" && value.length > 8) {
    maskedEnv[key] = `${value.slice(0, 4)}****${value.slice(-4)}`;
  } else {
    maskedEnv[key] = "********";
  }
}

// Log to console, which Vercel captures in Build Logs
console.log("Environment Variables at Build Time:");
console.log(JSON.stringify(maskedEnv, null, 2));
