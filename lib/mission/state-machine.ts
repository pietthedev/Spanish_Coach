import type { Scenario } from "@/content/schema";
import type { EvaluationResult } from "@/lib/evaluation/evaluate";

export interface MissionState {
  currentTurnId: string;
  completedIntents: string[];
  attemptsForTurn: number;
  complete: boolean;
}

export function startMission(scenario: Scenario): MissionState {
  return {
    currentTurnId: scenario.startTurnId,
    completedIntents: [],
    attemptsForTurn: 0,
    complete: false,
  };
}

export function advanceHostTurn(
  state: MissionState,
  scenario: Scenario,
): MissionState {
  const turn = scenario.turns.find((item) => item.id === state.currentTurnId);
  if (!turn || turn.speaker !== "host") return state;
  if (!turn.next)
    return { ...state, complete: scenario.successTurnIds.includes(turn.id) };
  return { ...state, currentTurnId: turn.next, attemptsForTurn: 0 };
}

export function submitMissionAnswer(
  state: MissionState,
  scenario: Scenario,
  evaluation: EvaluationResult,
): MissionState {
  const turn = scenario.turns.find((item) => item.id === state.currentTurnId);
  if (!turn || turn.speaker !== "learner") return state;
  const passed = ["understood", "minor-issue", "different-valid"].includes(
    evaluation.outcome,
  );
  if (!passed) return { ...state, attemptsForTurn: state.attemptsForTurn + 1 };
  const completedIntents =
    turn.expectedIntent && !state.completedIntents.includes(turn.expectedIntent)
      ? [...state.completedIntents, turn.expectedIntent]
      : state.completedIntents;
  if (!turn.next)
    return {
      ...state,
      completedIntents,
      complete: scenario.requiredIntents.every((intent) =>
        completedIntents.includes(intent),
      ),
    };
  return {
    currentTurnId: turn.next,
    completedIntents,
    attemptsForTurn: 0,
    complete: false,
  };
}
