import { describe, expect, it } from "bun:test";
import { runWithConcurrency } from "../src/utils/runWithConcurrency";

describe("runWithConcurrency", () => {
  it("limits simultaneous tasks", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await runWithConcurrency([1, 2, 3, 4, 5], 2, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
