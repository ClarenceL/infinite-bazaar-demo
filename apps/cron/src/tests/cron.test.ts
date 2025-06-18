import { Queue } from "bullmq";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("Cron Service", () => {
  let redis: Redis;
  let queue: Queue;

  beforeAll(async () => {
    // Use test database
    redis = new Redis({
      host: "localhost",
      port: 6379,
      db: 1, // Use different database for tests
      lazyConnect: true,
    });

    queue = new Queue("test-health-check", { connection: redis });
  });

  afterAll(async () => {
    await queue.close();
    await redis.quit();
  });

  it("should create a queue successfully", async () => {
    expect(queue).toBeDefined();
    expect(queue.name).toBe("test-health-check");
  });

  it("should add a job to the queue", async () => {
    const job = await queue.add("test-job", { url: "http://localhost:3105/health" });
    expect(job).toBeDefined();
    expect(job.data.url).toBe("http://localhost:3105/health");
  });

  it("should handle repeatable jobs", async () => {
    const job = await queue.add(
      "repeatable-test",
      { url: "http://localhost:3105/health" },
      {
        repeat: {
          every: 5000, // 5 seconds
        },
      },
    );

    expect(job).toBeDefined();

    // Clean up the repeatable job
    const repeatableJobs = await queue.getRepeatableJobs();
    for (const repeatableJob of repeatableJobs) {
      await queue.removeRepeatableByKey(repeatableJob.key);
    }
  });
});
