import { closeConnection } from "@infinite-bazaar-demo/db";
import { execa } from "execa";
import { cleanupTestDatabase, setupTestDatabase } from "./setup";
import { isRunningDirectly } from "./setup";

async function runTests(testNamePattern?: string) {
  try {
    // Set up the test database
    console.log("Setting up test database...");
    await setupTestDatabase();

    // Run the tests
    console.log("Running tests...");
    // Use the correct format for Vitest CLI arguments
    const args = ["run", "src/tests"];

    // Add test name pattern if provided
    if (testNamePattern) {
      args.push("-t", testNamePattern);
      console.log(`Filtering tests with pattern: "${testNamePattern}"`);
    }

    await execa("vitest", args, { stdio: "inherit" });

    // Clean up the test database
    console.log("Cleaning up test database...");
    await cleanupTestDatabase();

    console.log("Tests completed successfully");
  } catch (error) {
    console.error("Error running tests:", error);

    // Attempt to clean up even if tests fail
    try {
      await cleanupTestDatabase();
    } catch (cleanupError) {
      console.error("Error cleaning up test database:", cleanupError);
    }

    process.exit(1);
  } finally {
    // Close the database connection to allow the process to exit
    try {
      await closeConnection();
    } catch (err) {
      console.error("Error closing database connection:", err);
    }

    // Force exit if needed
    process.exit(0);
  }
}

// Run the tests if this file is executed directly
if (isRunningDirectly(import.meta.url)) {
  // Get test name pattern from command line arguments
  const testNamePattern = process.argv[2];
  runTests(testNamePattern);
}
