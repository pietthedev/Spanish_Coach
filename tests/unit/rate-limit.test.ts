import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/speech/rate-limit";
describe("speech rate limiting", () => {
  beforeEach(resetRateLimits);
  it("limits each identity within a minute", () => {
    expect(checkRateLimit("a", 2, 0)).toBe(true);
    expect(checkRateLimit("a", 2, 1)).toBe(true);
    expect(checkRateLimit("a", 2, 2)).toBe(false);
    expect(checkRateLimit("b", 2, 2)).toBe(true);
    expect(checkRateLimit("a", 2, 60_001)).toBe(true);
  });
});
