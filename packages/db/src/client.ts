import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Store the raw postgres client so we can access it later
let rawClient: ReturnType<typeof postgres> | null = null;

export function createClient(connectionString: string) {
  // Log the connection string being used (without password)
  const sanitizedConnectionString = connectionString.replace(/:[^:@]+@/, ":***@");
  console.log(`Creating database client with connection: ${sanitizedConnectionString}`);

  // Create the postgres client and store it
  rawClient = postgres(connectionString, { prepare: false });
  const drizzleConfig = {
    schema,
    driver: "pg",
    dbCredentials: {
      connectionString: connectionString,
    },
  };
  return drizzle(rawClient, drizzleConfig);
}

// Function to close the database connection
export async function closeConnection() {
  if (rawClient) {
    console.log("Closing postgres connection...");
    await rawClient.end();
    rawClient = null;
    console.log("Postgres connection closed");
  } else {
    console.log("No postgres connection to close");
  }
}
