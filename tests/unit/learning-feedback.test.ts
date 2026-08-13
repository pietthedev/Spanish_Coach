import { describe, expect, it } from "vitest";
import { phraseById } from "@/content/course";
import { evaluateAnswer } from "@/lib/evaluation/evaluate";
import { describeBandChange, stepFeedback } from "@/lib/learning/feedback";
import { applyAttempt } from "@/lib/learning/mastery";
import { emptyMastery, type RetrievalAttempt } from "@/lib/learning/types";

const now = new Date("2026-08-20T08:00:00.000Z");
const slower = phraseById.get("mx.repair.slower_full")!;
const hola = phraseById.get("mx.greeting.hola")!;

function attempt(overrides: Partial<RetrievalAttempt> = {}): RetrievalAttempt {
  return {
    phraseId: hola.id,
    outcome: "understood",
    assistance: "none",
    cueType: "english",
    stepKind: "spoken-recall",
    hintCount: 0,
    answerVisible: false,
    attemptNumber: 1,
    timestamp: now.toISOString(),
    ...overrides,
  };
}

describe("corrective feedback", () => {
  it("names what survived instead of only marking it wrong", () => {
    const result = evaluateAnswer("hablar despacio", slower);
    const feedback = stepFeedback(result, slower, "none");
    expect(feedback.tone).not.toBe("success");
    expect(feedback.detail).toMatch(/listen again/i);
    expect(feedback.replay).toBe(true);
  });

  it("treats a meaning change more seriously than an accent slip", () => {
    const minor = stepFeedback(
      { outcome: "minor-issue", label: "", message: "", transcript: "" },
      slower,
      "none",
    );
    const meaning = stepFeedback(
      { outcome: "meaning-error", label: "", message: "x", transcript: "" },
      slower,
      "none",
    );
    expect(minor.tone).toBe("success");
    expect(minor.detail).toMatch(/understood/i);
    expect(meaning.tone).toBe("rebuild");
  });

  it("reassures the learner that a technical failure is not their fault", () => {
    const feedback = stepFeedback(
      {
        outcome: "technical-failure",
        label: "",
        message: "The microphone is unavailable.",
        transcript: "",
      },
      hola,
      "none",
    );
    expect(feedback.detail).toMatch(/does not count against your progress/i);
  });

  it("separates pronunciation praise from retrieval praise", () => {
    const visible = stepFeedback(
      { outcome: "understood", label: "", message: "", transcript: "" },
      hola,
      "answer-visible",
    );
    const recalled = stepFeedback(
      { outcome: "understood", label: "", message: "", transcript: "" },
      hola,
      "none",
    );
    expect(visible.headline).toMatch(/pronunciation/i);
    expect(visible.detail).toMatch(/from memory later/i);
    expect(recalled.headline).toMatch(/from memory/i);
  });

  it("frames a hinted success as progress, not failure", () => {
    const feedback = stepFeedback(
      { outcome: "understood", label: "", message: "", transcript: "" },
      hola,
      "hint-2",
    );
    expect(feedback.tone).toBe("success");
    expect(feedback.detail).toMatch(/return sooner/i);
  });
});

describe("band change reporting", () => {
  it("counts an independent retrieval as strengthening", () => {
    const before = emptyMastery(now.toISOString());
    const after = applyAttempt(before, attempt(), now);
    const change = describeBandChange(hola, before, after);
    expect(change.strengthened).toBe(true);
    expect(change.summary).toBe("now fragile");
  });

  it("does not claim progress when the answer had to be revealed", () => {
    const before = emptyMastery(now.toISOString());
    const after = applyAttempt(
      before,
      attempt({ outcome: "incomplete", assistance: "revealed" }),
      now,
    );
    const change = describeBandChange(hola, before, after);
    expect(change.strengthened).toBe(false);
    expect(change.summary).toBe("needs another attempt");
  });

  it("does not claim progress for repeating a visible phrase", () => {
    const before = emptyMastery(now.toISOString());
    const after = applyAttempt(
      before,
      attempt({ assistance: "repeat-only", stepKind: "introduce" }),
      now,
    );
    const change = describeBandChange(hola, before, after);
    expect(change.strengthened).toBe(false);
    expect(change.after).toBe("familiar");
  });
});
