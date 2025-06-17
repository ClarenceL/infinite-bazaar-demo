import { randomInt } from "node:crypto";
import { afterEach, beforeEach, describe } from "node:test";
import { expect, test, vi } from "vitest";
import { newId } from "./generate.js";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});
describe("ids are k-sorted by time", () => {
  const testCases = [
    {
      k: 2,
      n: 1_000,
    },
    {
      k: 10,
      n: 5_000,
    },
  ];

  for (const tc of testCases) {
    test(`k: ${tc.k}, n: ${tc.n}`, () => {
      const ids = new Array(tc.n).fill(null).map((_, i) => {
        vi.setSystemTime(new Date(i * 10));

        return newId("test");
      });
      const sorted = [...ids].sort();

      for (let i = 0; i < ids.length; i++) {
        const sortedId = sorted[i];
        if (sortedId) {
          expect(Math.abs(ids.indexOf(sortedId) - i)).toBeLessThanOrEqual(tc.k);
        }
      }
    });
  }
});

test("suffix length is between 26-28 characters long", () => {
  for (let i = 0; i < 50_000; i++) {
    vi.setSystemTime(new Date(randomInt(281474976710655)));

    const parts = newId("test").split("_");
    const suffix = parts[1];
    if (suffix) {
      expect(suffix.length).toBeGreaterThanOrEqual(26);
      expect(suffix.length).toBeLessThanOrEqual(28);
    }
  }
});
