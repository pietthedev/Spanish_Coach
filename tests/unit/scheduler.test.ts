import { describe, expect, it } from "vitest";
import { scheduleReview, selectDueReviews } from "@/lib/review/scheduler";
const now = new Date("2026-08-10T08:00:00.000Z");

describe("review scheduler", () => {
  it("uses the prescribed success progression", () => {
    let state = scheduleReview(undefined, "understood", now);
    expect(state.intervalStep).toBe(0);
    expect(state.dueAt).toBe("2026-08-10T08:10:00.000Z");
    state = scheduleReview(
      state,
      "understood",
      new Date("2026-08-10T08:10:00Z"),
    );
    expect(state.dueAt).toBe("2026-08-11T08:10:00.000Z");
    state = scheduleReview(
      state,
      "understood",
      new Date("2026-08-11T08:10:00Z"),
    );
    expect(state.dueAt).toBe("2026-08-14T08:10:00.000Z");
  });
  it("returns meaning errors in the same lesson", () => {
    expect(scheduleReview(undefined, "meaning-error", now).dueAt).toBe(
      "2026-08-10T08:10:00.000Z",
    );
  });
  it("counts minor issues but returns them tomorrow", () => {
    const state = scheduleReview(
      { intervalStep: 3, dueAt: now.toISOString(), consecutiveSuccesses: 3 },
      "minor-issue",
      now,
    );
    expect(state.consecutiveSuccesses).toBe(4);
    expect(state.intervalStep).toBe(3);
    expect(state.dueAt).toBe("2026-08-11T08:00:00.000Z");
  });
  it("does not weaken mastery on technical failure", () => {
    const before = {
      intervalStep: 3,
      dueAt: "2026-08-17T08:00:00.000Z",
      consecutiveSuccesses: 4,
    };
    expect(scheduleReview(before, "technical-failure", now)).toEqual(before);
  });
  it("caps the daily due queue", () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      id: index,
      dueAt: `2026-08-0${index + 1}T08:00:00Z`,
    }));
    expect(selectDueReviews(items, now, 5)).toHaveLength(5);
  });
});
