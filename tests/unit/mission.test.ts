import { describe, expect, it } from "vitest";
import { course } from "@/content/course";
import {
  advanceHostTurn,
  startMission,
  submitMissionAnswer,
} from "@/lib/mission/state-machine";
const scenario = course.scenarios[0]!;
const pass = {
  outcome: "understood",
  label: "Understood",
  message: "ok",
  transcript: "",
} as const;
const fail = {
  outcome: "meaning-error",
  label: "Fix",
  message: "no",
  transcript: "",
} as const;

describe("Friendly arrival state machine", () => {
  it("starts at the authored host turn", () => {
    expect(startMission(scenario).currentTurnId).toBe("host-welcome");
  });
  it("does not advance a failed learner intent", () => {
    const state = advanceHostTurn(startMission(scenario), scenario);
    const next = submitMissionAnswer(state, scenario, fail);
    expect(next.currentTurnId).toBe("learner-greet");
    expect(next.attemptsForTurn).toBe(1);
  });
  it("requires all six intents for deterministic success", () => {
    let state = startMission(scenario);
    let guard = 0;
    while (!state.complete && guard++ < 30) {
      const turn = scenario.turns.find(
        (item) => item.id === state.currentTurnId,
      )!;
      state =
        turn.speaker === "host"
          ? advanceHostTurn(state, scenario)
          : submitMissionAnswer(state, scenario, pass);
    }
    expect(state.complete).toBe(true);
    expect(state.completedIntents).toEqual(scenario.requiredIntents);
  });
});
