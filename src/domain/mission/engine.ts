/**
 * Mission State Machine Engine
 * 
 * Framework-independent deterministic mission execution.
 * No runtime AI for dialogue invention or success decisions.
 */

import type {
  MissionDefinition,
  MissionState,
  MissionTransition,
  ScenarioIntent,
  AudioReference
} from '../content/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Current state of a running mission
 */
export interface MissionRunState {
  /** Mission definition */
  readonly mission: MissionDefinition;
  /** Current state ID */
  readonly currentStateId: string;
  /** States visited in order */
  readonly visitedStates: string[];
  /** Number of failures in current state */
  readonly currentFailures: number;
  /** Total failures across mission */
  readonly totalFailures: number;
  /** Whether mission is complete */
  readonly isComplete: boolean;
  /** Whether mission succeeded */
  readonly isSuccess: boolean;
  /** Hints shown */
  readonly hintsShown: string[];
}

/**
 * Result of processing learner input
 */
export interface MissionActionResult {
  /** New mission state after action */
  readonly newState: MissionRunState;
  /** Character response to show */
  readonly characterResponse?: string;
  /** Response audio if available */
  readonly responseAudio?: AudioReference;
  /** Hint to show (if any) */
  readonly hint?: string;
  /** Whether to show success feedback */
  readonly showSuccessFeedback: boolean;
  /** Whether to show retry feedback */
  readonly showRetryFeedback: boolean;
  /** Whether mission ended */
  readonly missionEnded: boolean;
}

/**
 * Evaluation of learner input against allowed intents
 */
export interface IntentMatchResult {
  /** Whether an intent matched */
  readonly matched: boolean;
  /** Matched intent if any */
  readonly matchedIntent?: ScenarioIntent;
  /** Trigger type based on match quality */
  readonly trigger: 'success' | 'partial' | 'failure';
  /** Confidence score 0-1 */
  readonly confidence: number;
}

// ============================================================================
// MISSION ENGINE
// ============================================================================

/**
 * Create initial mission run state
 */
export function createMissionRunState(mission: MissionDefinition): MissionRunState {
  return {
    mission,
    currentStateId: mission.initialState,
    visitedStates: [mission.initialState],
    currentFailures: 0,
    totalFailures: 0,
    isComplete: false,
    isSuccess: false,
    hintsShown: []
  };
}

/**
 * Get current state from mission definition
 */
export function getCurrentState(
  mission: MissionDefinition,
  stateId: string
): MissionState | undefined {
  return mission.states.find(s => s.stateId === stateId);
}

/**
 * Evaluate learner input against allowed intents
 */
export function evaluateIntent(
  transcript: string,
  allowedIntents: ScenarioIntent[]
): IntentMatchResult {
  if (!transcript || transcript.trim() === '') {
    return {
      matched: false,
      trigger: 'failure',
      confidence: 0
    };
  }

  const normalisedTranscript = transcript.toLowerCase().trim();

  // Check each intent for matches
  for (const intent of allowedIntents) {
    for (const variant of intent.acceptedVariants) {
      const normalisedVariant = variant.toLowerCase().trim();
      
      // Exact match
      if (normalisedTranscript === normalisedVariant) {
        return {
          matched: true,
          matchedIntent: intent,
          trigger: 'success',
          confidence: 1.0
        };
      }
      
      // Contains match (for longer responses)
      if (normalisedTranscript.includes(normalisedVariant) && normalisedVariant.length > 3) {
        return {
          matched: true,
          matchedIntent: intent,
          trigger: 'success',
          confidence: 0.95
        };
      }
    }

    // Check required concepts
    if (intent.requiredConcepts && intent.requiredConcepts.length > 0) {
      let allConceptsPresent = true;
      for (const concept of intent.requiredConcepts) {
        const hasExpression = concept.expressions.some(expr =>
          normalisedTranscript.includes(expr.toLowerCase())
        );
        if (!hasExpression && concept.required) {
          allConceptsPresent = false;
          break;
        }
      }

      if (allConceptsPresent) {
        return {
          matched: true,
          matchedIntent: intent,
          trigger: 'success',
          confidence: 0.9
        };
      }
    }
  }

  // Partial match - check for any keyword overlap
  const transcriptWords = new Set(normalisedTranscript.split(/\s+/));
  let bestOverlap = 0;
  let bestIntent: ScenarioIntent | undefined;

  for (const intent of allowedIntents) {
    for (const variant of intent.acceptedVariants) {
      const variantWords = variant.toLowerCase().split(/\s+/);
      let overlap = 0;
      for (const word of variantWords) {
        if (transcriptWords.has(word)) {
          overlap++;
        }
      }
      const overlapRatio = overlap / variantWords.length;
      if (overlapRatio > bestOverlap && overlapRatio >= 0.5) {
        bestOverlap = overlapRatio;
        bestIntent = intent;
      }
    }
  }

  if (bestOverlap >= 0.5) {
    return {
      matched: true,
      matchedIntent: bestIntent,
      trigger: 'partial',
      confidence: bestOverlap
    };
  }

  return {
    matched: false,
    trigger: 'failure',
    confidence: 0
  };
}

/**
 * Process learner action and return new state
 */
export function processLearnerAction(
  currentState: MissionRunState,
  transcript: string
): MissionActionResult {
  const { mission, currentStateId, currentFailures, totalFailures, visitedStates } = currentState;
  
  // Get current state definition
  const stateDef = getCurrentState(mission, currentStateId);
  if (!stateDef) {
    return {
      newState: currentState,
      showSuccessFeedback: false,
      showRetryFeedback: false,
      missionEnded: false
    };
  }

  // Evaluate intent
  const intentResult = evaluateIntent(transcript, stateDef.allowedIntents);

  // Find matching transition
  const transition = findTransition(stateDef.transitions, intentResult.trigger);
  
  if (!transition) {
    // No transition for this trigger - treat as failure
    return handleFailure(currentState, stateDef, 'No valid response path');
  }

  // Check max retries
  if (currentFailures >= stateDef.maxRetries) {
    // Show solution and move on
    return handleMaxRetriesReached(currentState, stateDef, transition);
  }

  // Handle based on trigger type
  switch (intentResult.trigger) {
    case 'success':
      return handleSuccess(currentState, stateDef, transition, intentResult.matchedIntent);
    
    case 'partial':
      return handlePartialSuccess(currentState, stateDef, transition);
    
    case 'failure':
      return handleFailure(currentState, stateDef, intentResult.matchedIntent?.description);
  }
}

/**
 * Find transition for trigger type
 */
function findTransition(
  transitions: MissionTransition[],
  trigger: 'success' | 'partial' | 'failure' | 'timeout'
): MissionTransition | undefined {
  // Try exact trigger first
  let transition = transitions.find(t => t.trigger === trigger);
  
  // Fall back to failure for partial
  if (!transition && trigger === 'partial') {
    transition = transitions.find(t => t.trigger === 'partial') || 
                 transitions.find(t => t.trigger === 'failure');
  }
  
  // Default to failure if nothing else
  if (!transition) {
    transition = transitions.find(t => t.trigger === 'failure');
  }
  
  return transition;
}

/**
 * Handle successful response
 */
function handleSuccess(
  state: MissionRunState,
  stateDef: MissionState,
  transition: MissionTransition,
  matchedIntent?: ScenarioIntent
): MissionActionResult {
  const newState: MissionRunState = {
    ...state,
    currentStateId: transition.nextStateId,
    visitedStates: [...state.visitedStates, transition.nextStateId],
    currentFailures: 0,
    isComplete: transition.nextStateId === 'state_complete' ||
                transition.nextStateId === state.mission.successCondition.finalStateId
  };

  if (newState.isComplete) {
    newState.isSuccess = true;
  }

  return {
    newState,
    characterResponse: transition.response,
    responseAudio: transition.responseAudio,
    showSuccessFeedback: true,
    showRetryFeedback: false,
    missionEnded: newState.isComplete
  };
}

/**
 * Handle partial success
 */
function handlePartialSuccess(
  state: MissionRunState,
  stateDef: MissionState,
  transition: MissionTransition
): MissionActionResult {
  const newState: MissionRunState = {
    ...state,
    currentStateId: transition.nextStateId,
    visitedStates: [...state.visitedStates, transition.nextStateId],
    currentFailures: 0,
    isComplete: transition.nextStateId === 'state_complete' ||
                transition.nextStateId === state.mission.successCondition.finalStateId
  };

  if (newState.isComplete) {
    newState.isSuccess = true;
  }

  return {
    newState,
    characterResponse: transition.response,
    responseAudio: transition.responseAudio,
    showSuccessFeedback: true,
    showRetryFeedback: false,
    missionEnded: newState.isComplete
  };
}

/**
 * Handle failure
 */
function handleFailure(
  state: MissionRunState,
  stateDef: MissionState,
  reason?: string
): MissionActionResult {
  const newFailures = state.currentFailures + 1;
  const newTotalFailures = state.totalFailures + 1;

  // Check if should show hint
  let hint: string | undefined;
  const hintConfig = state.mission.hints.find(h => 
    (!h.triggerState || h.triggerState === state.currentStateId) &&
    h.attemptsBeforeShow <= newFailures
  );
  
  if (hintConfig) {
    hint = hintConfig.hintText;
  }

  // Check max total failures
  const shouldContinue = newTotalFailures < state.mission.maxTotalRetries &&
                         newFailures < stateDef.maxRetries &&
                         state.mission.failureRecovery.allowContinue;

  return {
    newState: {
      ...state,
      currentFailures: newFailures,
      totalFailures: newTotalFailures,
      hintsShown: hint ? [...state.hintsShown, hint] : state.hintsShown
    },
    hint,
    characterResponse: shouldContinue ? stateDef.hint : undefined,
    showSuccessFeedback: false,
    showRetryFeedback: true,
    missionEnded: !shouldContinue
  };
}

/**
 * Handle max retries reached - show solution
 */
function handleMaxRetriesReached(
  state: MissionRunState,
  stateDef: MissionState,
  transition: MissionTransition
): MissionActionResult {
  const newState: MissionRunState = {
    ...state,
    currentStateId: transition.nextStateId,
    visitedStates: [...state.visitedStates, transition.nextStateId],
    currentFailures: 0
  };

  return {
    newState,
    characterResponse: transition.response,
    responseAudio: transition.responseAudio,
    showSuccessFeedback: false,
    showRetryFeedback: false,
    missionEnded: newState.isComplete
  };
}

/**
 * Check if mission is complete
 */
export function isMissionComplete(state: MissionRunState): boolean {
  return state.isComplete || 
         state.totalFailures >= state.mission.maxTotalRetries;
}

/**
 * Get mission success status
 */
export function getMissionSuccess(state: MissionRunState): boolean {
  if (!state.isComplete) {
    return false;
  }
  
  const { successCondition } = state.mission;
  
  return state.currentStateId === successCondition.finalStateId &&
         state.visitedStates.length >= successCondition.minStatesVisited &&
         state.totalFailures <= successCondition.maxFailures;
}

/**
 * Get available hints for current state
 */
export function getAvailableHints(
  state: MissionRunState,
  failCount: number
): string[] {
  return state.mission.hints
    .filter(h => 
      (!h.triggerState || h.triggerState === state.currentStateId) &&
      h.attemptsBeforeShow <= failCount &&
      !state.hintsShown.includes(h.hintText)
    )
    .map(h => h.hintText);
}
