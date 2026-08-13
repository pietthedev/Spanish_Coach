import { describe, expect, it } from "vitest";
import { course, phraseById } from "@/content/course";
import { matchCommand } from "@/lib/drive/commands";
import {
  currentActivity,
  driveReducer,
  initialContext,
  reinsertLater,
  toneFor,
  type DriveContext,
  type DriveEvent,
} from "@/lib/drive/machine";
import { planDriveSession } from "@/lib/drive/planner";
import type { EvaluationOutcome, EvaluationResult } from "@/lib/evaluation/evaluate";
import { emptyMastery, type PhraseMastery } from "@/lib/learning/types";

const now = new Date("2026-08-20T08:00:00.000Z");

function mastery(): Map<string, PhraseMastery> {
  return new Map(
    course.phrases.map((phrase) => [
      phrase.id,
      {
        ...emptyMastery("2026-08-19T08:00:00.000Z"),
        intervalStep: 2,
        encounters: 4,
        independentSuccesses: 1,
        independentDays: ["2026-08-18"],
      },
    ]),
  );
}

const plan = planDriveSession({
  duration: 15,
  phrases: phraseById,
  mastery: mastery(),
  scenarios: course.scenarios,
  now,
});

const run = (events: DriveEvent[], from = initialContext()): DriveContext =>
  events.reduce(driveReducer, from);

const started = () =>
  run([{ type: "PREPARED", plan }, { type: "INTRO_DONE" }]);

const result = (outcome: EvaluationOutcome): EvaluationResult => ({
  outcome,
  label: "",
  message: "",
  transcript: "hola",
});

describe("drive lifecycle", () => {
  it("walks from idle through the intro to the first prompt", () => {
    const context = run([{ type: "PREPARED", plan }]);
    expect(context.state).toBe("intro");
    expect(driveReducer(context, { type: "INTRO_DONE" }).state).toBe("prompting");
    expect(currentActivity(started())).toBeDefined();
  });

  it("opens the microphone only after the prompt finishes", () => {
    const prompting = started();
    expect(prompting.state).toBe("prompting");
    const thinking = driveReducer(prompting, { type: "PROMPT_DONE" });
    expect(thinking.state).toBe("thinking");
    expect(driveReducer(thinking, { type: "THINK_ELAPSED" }).state).toBe("listening");
  });

  it("stops waiting as soon as the learner starts speaking", () => {
    const thinking = run([{ type: "PROMPT_DONE" }], started());
    expect(driveReducer(thinking, { type: "SPEECH_STARTED" }).state).toBe("listening");
  });

  it("moves a clean answer straight to feedback and on to the next activity", () => {
    const listening = run(
      [{ type: "PROMPT_DONE" }, { type: "THINK_ELAPSED" }],
      started(),
    );
    const evaluated = driveReducer(listening, {
      type: "EVALUATED",
      result: result("understood"),
    });
    expect(evaluated.state).toBe("feedback");
    expect(evaluated.lastTone).toBe("correct");
    const next = driveReducer(evaluated, { type: "FEEDBACK_DONE" });
    expect(next.state).toBe("prompting");
    expect(next.index).toBe(1);
    expect(next.hintLevel).toBe(0);
  });

  it("coaches a meaning error instead of moving on", () => {
    const listening = run(
      [{ type: "PROMPT_DONE" }, { type: "THINK_ELAPSED" }],
      started(),
    );
    const evaluated = driveReducer(listening, {
      type: "EVALUATED",
      result: result("meaning-error"),
    });
    expect(evaluated.state).toBe("coaching");
    expect(evaluated.lastTone).toBe("retry");
    // Coaching returns to the same activity for a guided retry.
    const retry = driveReducer(evaluated, { type: "FEEDBACK_DONE" });
    expect(retry.state).toBe("prompting");
    expect(retry.index).toBe(evaluated.index);
  });

  it("gives up on a stubborn activity rather than looping forever", () => {
    let context = started();
    // Two genuine attempts, each with its own prompt and coaching cycle.
    for (let i = 0; i < 3; i += 1)
      context = run(
        [
          { type: "PROMPT_DONE" },
          { type: "THINK_ELAPSED" },
          { type: "EVALUATED", result: result("meaning-error") },
          { type: "FEEDBACK_DONE" },
        ],
        context,
      );
    expect(context.index).toBeGreaterThan(0);
    // The phrase is not abandoned: it comes back later in the same drive.
    expect(context.activities.some((a) => a.origin === "reinserted")).toBe(true);
  });

  it("records the assistance level that applied at the moment of the answer", () => {
    const hinted = run(
      [
        { type: "PROMPT_DONE" },
        { type: "THINK_ELAPSED" },
        { type: "COMMAND", command: "hint" },
        { type: "PROMPT_DONE" },
        { type: "THINK_ELAPSED" },
        { type: "EVALUATED", result: result("understood") },
      ],
      started(),
    );
    expect(hinted.records.at(-1)).toMatchObject({
      assistanceLevel: "hint-1",
      independent: false,
      hinted: true,
    });
  });

  it("treats an unaided correct answer as independent evidence", () => {
    const clean = run(
      [
        { type: "PROMPT_DONE" },
        { type: "THINK_ELAPSED" },
        { type: "EVALUATED", result: result("understood") },
      ],
      started(),
    );
    expect(clean.records.at(-1)).toMatchObject({ independent: true, hinted: false });
  });
});

describe("technical failure", () => {
  it("never sounds like a wrong answer", () => {
    expect(toneFor("technical-failure")).toBe("technical");
    expect(toneFor("meaning-error")).toBe("retry");
    expect(toneFor("incomplete")).toBe("retry");
    expect(toneFor("minor-issue")).toBe("acceptable");
    expect(toneFor("understood")).toBe("correct");
    expect(toneFor("different-valid")).toBe("correct");
  });

  it("retries without recording it against the learner", () => {
    const context = run(
      [
        { type: "PROMPT_DONE" },
        { type: "THINK_ELAPSED" },
        { type: "EVALUATED", result: result("technical-failure") },
      ],
      started(),
    );
    expect(context.lastTone).toBe("technical");
    expect(context.state).toBe("prompting");
    expect(context.records.at(-1)).toMatchObject({
      technical: true,
      independent: false,
    });
  });
});

describe("driver attention", () => {
  it("replays rather than assuming silence means failure", () => {
    const listening = run(
      [{ type: "PROMPT_DONE" }, { type: "THINK_ELAPSED" }],
      started(),
    );
    const silent = driveReducer(listening, { type: "NO_SPEECH" });
    expect(silent.state).toBe("prompting");
    expect(silent.pending).toEqual({ type: "replay-prompt" });
    expect(silent.records).toHaveLength(0);
  });

  it("moves on after repeated silence without penalising mastery", () => {
    let context = run([{ type: "PROMPT_DONE" }, { type: "THINK_ELAPSED" }], started());
    for (let i = 0; i < 3; i += 1)
      context = driveReducer(context, { type: "NO_SPEECH" });
    expect(context.index).toBe(1);
    expect(context.records).toHaveLength(0);
  });
});

describe("voice commands", () => {
  it("recognises the supported commands in English and Spanish", () => {
    expect(matchCommand("again")).toBe("again");
    expect(matchCommand("otra vez")).toBe("again");
    expect(matchCommand("hint")).toBe("hint");
    expect(matchCommand("pista")).toBe("hint");
    expect(matchCommand("I don't know")).toBe("dont-know");
    expect(matchCommand("no sé")).toBe("dont-know");
    expect(matchCommand("skip")).toBe("skip");
    expect(matchCommand("pause")).toBe("pause");
    expect(matchCommand("resume")).toBe("resume");
  });

  it("does not mistake a real Spanish answer for a command", () => {
    for (const phrase of course.phrases)
      expect(matchCommand(phrase.esMX)).toBeUndefined();
    expect(matchCommand("¿Puede hablar más despacio?")).toBeUndefined();
    expect(matchCommand("Buenos días")).toBeUndefined();
  });

  it("ignores command words buried inside a longer utterance", () => {
    expect(matchCommand("no sé cómo se dice buenos días")).toBeUndefined();
  });

  it("replays the prompt on Again without recording an attempt", () => {
    const context = run([{ type: "COMMAND", command: "again" }], started());
    expect(context.state).toBe("prompting");
    expect(context.pending).toEqual({ type: "replay-prompt" });
    expect(context.records).toHaveLength(0);
  });

  it("climbs the hint ladder one level at a time", () => {
    let context = started();
    for (const level of [1, 2, 3, 3]) {
      context = driveReducer(context, { type: "COMMAND", command: "hint" });
      expect(context.hintLevel).toBe(level);
      expect(context.pending).toEqual({ type: "speak-hint", level });
    }
  });

  it("teaches the answer and queues it again on I don't know", () => {
    const context = run([{ type: "COMMAND", command: "dont-know" }], started());
    expect(context.state).toBe("coaching");
    expect(context.revealed).toBe(true);
    expect(context.pending).toEqual({ type: "teach-answer" });
    expect(context.activities.length).toBe(plan.activities.length + 1);
  });

  it("skips without treating it as a failure", () => {
    const context = run([{ type: "COMMAND", command: "skip" }], started());
    expect(context.index).toBe(1);
    expect(context.records).toHaveLength(0);
    expect(context.activities.length).toBe(plan.activities.length);
  });

  it("pauses and resumes back to where it left off", () => {
    const listening = run(
      [{ type: "PROMPT_DONE" }, { type: "THINK_ELAPSED" }],
      started(),
    );
    const paused = driveReducer(listening, { type: "PAUSE" });
    expect(paused.state).toBe("paused");
    expect(driveReducer(paused, { type: "RESUME" }).state).toBe("listening");
  });
});

describe("same-drive re-retrieval", () => {
  it("brings a missed phrase back later in a different context", () => {
    const activities = plan.activities;
    const retried = reinsertLater(activities, 0, 4);
    expect(retried).toHaveLength(activities.length + 1);
    const retry = retried.find((a) => a.origin === "reinserted")!;
    expect(retried.indexOf(retry)).toBeGreaterThan(1);
    expect(retry.cueType).not.toBe(activities[0]!.cueType);
    expect(retry.phraseId).toBe(activities[0]!.phraseId);
  });

  it("turns a missed new phrase into a recall rather than another repetition", () => {
    const shadow = plan.activities.findIndex((a) => a.kind === "shadow");
    if (shadow === -1) return;
    const retry = reinsertLater(plan.activities, shadow, 3).find(
      (a) => a.origin === "reinserted",
    )!;
    expect(retry.kind).toBe("contextual-recall");
  });

  it("only queues one retry per phrase per drive", () => {
    let context = run([{ type: "COMMAND", command: "dont-know" }], started());
    const afterFirst = context.activities.length;
    context = driveReducer(context, { type: "COMMAND", command: "dont-know" });
    expect(context.activities.length).toBe(afterFirst);
  });
});

describe("ending the drive", () => {
  it("finishes on a phrase the learner can probably produce", () => {
    let context = started();
    context = driveReducer(context, { type: "TICK", elapsedMs: plan.wrapAfterMs });
    context = run(
      [
        { type: "PROMPT_DONE" },
        { type: "THINK_ELAPSED" },
        { type: "EVALUATED", result: result("understood") },
        { type: "FEEDBACK_DONE" },
      ],
      context,
    );
    expect(context.closing).toBe(true);
    expect(currentActivity(context)?.phraseId).toBe(plan.closingPhraseId);
  });

  it("completes after the closing activity rather than cutting mid-answer", () => {
    let context = driveReducer(started(), {
      type: "TICK",
      elapsedMs: plan.wrapAfterMs,
    });
    context = run(
      [
        { type: "PROMPT_DONE" },
        { type: "THINK_ELAPSED" },
        { type: "EVALUATED", result: result("understood") },
        { type: "FEEDBACK_DONE" },
      ],
      context,
    );
    const done = run(
      [
        { type: "PROMPT_DONE" },
        { type: "THINK_ELAPSED" },
        { type: "EVALUATED", result: result("understood") },
        { type: "FEEDBACK_DONE" },
      ],
      context,
    );
    expect(done.state).toBe("completed");
    expect(done.endReason).toBe("completed");
  });

  it("does not end the moment the clock hits the target", () => {
    const ticked = driveReducer(started(), {
      type: "TICK",
      elapsedMs: plan.targetMs + 5_000,
    });
    expect(ticked.state).not.toBe("completed");
  });

  it("can be ended deliberately by the learner", () => {
    expect(run([{ type: "END" }], started())).toMatchObject({
      state: "completed",
      endReason: "ended-early",
    });
  });
});
