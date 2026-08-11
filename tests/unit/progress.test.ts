import { describe, expect, it } from "vitest";
import { calculateRhythm, foundationsReadiness } from "@/lib/progress/metrics";
describe("progress evidence", () => {
  it("allows one flexible day without erasing rhythm", () => {
    expect(
      calculateRhythm(["2026-08-10", "2026-08-12", "2026-08-13"], "2026-08-13"),
    ).toEqual({ current: 3, longest: 3, totalDays: 3 });
  });
  it("does not claim readiness without evidence", () => {
    expect(foundationsReadiness(0, 0, false)).toBe("Not started");
    expect(foundationsReadiness(7, 12, true)).toBe("Trip-ready");
  });
});
