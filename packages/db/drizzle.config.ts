import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./dist/schema.js",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:password@localhost:5432/infinite_bazaar_demo",
  },
  verbose: true,
  strict: true,
});
