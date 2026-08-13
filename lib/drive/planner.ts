import type { Phrase, Scenario } from "@/content/schema";
import { normalizeAnswer } from "@/lib/evaluation/normalize";
import { cueForBand } from "@/lib/learning/cue";
import { bandRank, memoryBand } from "@/lib/learning/mastery";
import { attentionOrder, prioritiseDue } from "@/lib/learning/session-planner";
import type { CueType, MemoryBand, PhraseMastery } from "@/lib/learning/types";
import {
  ACTIVITY_SECONDS,
  INTRO_SECONDS,
  OUTRO_SECONDS,
  type DriveActivity,
  type DriveActivityKind,
  type DriveDuration,
  type DriveOrigin,
  type DriveSessionPlan,
} from "./types";

export interface DrivePlanInput {
  duration: DriveDuration;
  phrases: ReadonlyMap<string, Phrase>;
  mastery: ReadonlyMap<string, PhraseMastery>;
  scenarios?: readonly Scenario[];
  /** Course-day material available to introduce, if any. */
  newPhraseIds?: readonly string[];
  now: Date;
}

/** Session ends this long before the target so it can finish naturally. */
const WRAP_LEAD_MS = 60_000;

type Category = "retrieval" | "listening" | "encoding";

interface Profile {
  retrieval: number;
  listening: number;
  encoding: number;
  /** Activities that must sit between introducing a phrase and recalling it. */
  newPhraseGap: number;
  maxNew: number;
  /** Review load at or above which new material is dropped entirely. */
  heavyReviewLoad: number;
}

/**
 * The three drives differ in shape, not just length. Longer drives spend the
 * extra time on spacing and varied contexts rather than more vocabulary.
 */
export const DRIVE_PROFILES: Record<DriveDuration, Profile> = {
  10: {
    retrieval: 0.8,
    listening: 0.15,
    encoding: 0.05,
    newPhraseGap: 3,
    maxNew: 1,
    heavyReviewLoad: 4,
  },
  15: {
    retrieval: 0.65,
    listening: 0.22,
    encoding: 0.13,
    newPhraseGap: 4,
    maxNew: 2,
    heavyReviewLoad: 8,
  },
  20: {
    retrieval: 0.6,
    listening: 0.25,
    encoding: 0.15,
    newPhraseGap: 7,
    maxNew: 2,
    heavyReviewLoad: 10,
  },
};

export function newPhraseAllowanceForDrive(
  duration: DriveDuration,
  dueCount: number,
  available: number,
): number {
  const profile = DRIVE_PROFILES[duration];
  if (available === 0) return 0;
  if (dueCount >= profile.heavyReviewLoad) return duration === 10 ? 0 : 1;
  return Math.min(profile.maxNew, available);
}

/** Retrieval route for a phrase, widening as the memory strengthens. */
function retrievalKindFor(band: MemoryBand, variant: number): DriveActivityKind {
  if (band === "new" || band === "familiar" || band === "fragile")
    return variant % 2 === 0 ? "intent-recall" : "contextual-recall";
  if (band === "retrievable")
    return variant % 3 === 0 ? "intent-recall" : "contextual-recall";
  return variant % 2 === 0 ? "contextual-recall" : "listen-respond";
}

function cueFor(
  phrase: Phrase,
  band: MemoryBand,
  kind: DriveActivityKind,
): CueType {
  if (kind === "intent-recall") return "english";
  if (kind === "listen-respond" || kind === "listen-meaning")
    return "spanish-audio";
  return cueForBand(band, phrase.likelyReplies.length > 0);
}

export function planDriveSession(input: DrivePlanInput): DriveSessionPlan {
  const { duration, phrases, mastery, now } = input;
  const profile = DRIVE_PROFILES[duration];
  const targetMs = duration * 60_000;
  const budgetSeconds = duration * 60 - INTRO_SECONDS - OUTRO_SECONDS;

  const known = [...mastery.entries()].filter(([id]) => phrases.has(id));
  const due = prioritiseDue(
    known
      .filter(([, record]) => new Date(record.dueAt) <= now)
      .map(([phraseId, record]) => ({ phraseId, mastery: record })),
    now,
  );
  const attention = attentionOrder(mastery, phrases, now);

  const availableNew = (input.newPhraseIds ?? []).filter(
    (id) => phrases.has(id) && !mastery.has(id),
  );
  const newPhraseIds = availableNew.slice(
    0,
    newPhraseAllowanceForDrive(duration, due.length, availableNew.length),
  );

  // Rotation order for retrieval: neediest first, recycled with new contexts
  // when the pool is smaller than the drive.
  const rotation = (attention.length ? attention : known.map(([phraseId, record]) => ({ phraseId, mastery: record })))
    .map((item) => item.phraseId)
    .filter((id) => phrases.has(id));

  const activities: DriveActivity[] = [];
  const spent: Record<Category, number> = {
    retrieval: 0,
    listening: 0,
    encoding: 0,
  };
  let totalSeconds = 0;
  let retrievalCursor = 0;
  let listeningCursor = 0;

  const push = (activity: DriveActivity, category: Category) => {
    activities.push(activity);
    totalSeconds += activity.estimatedSeconds;
    spent[category] += activity.estimatedSeconds;
  };

  const pairs = responsePairs(phrases);

  const makeRetrieval = (
    phraseId: string,
    variant: number,
    origin: DriveOrigin,
  ): DriveActivity | undefined => {
    const phrase = phrases.get(phraseId);
    if (!phrase) return undefined;
    const band = memoryBand(mastery.get(phraseId));
    let kind = retrievalKindFor(band, variant);
    const hostLine = pairs.get(phraseId);
    // Responding to spoken Spanish only works when the course actually
    // contains something for the coach to say.
    if (kind === "listen-respond" && !hostLine) kind = "contextual-recall";
    return {
      id: `drive.retrieve.${phraseId}.${variant}`,
      kind,
      phraseId,
      cueType: cueFor(phrase, band, kind),
      origin,
      estimatedSeconds: ACTIVITY_SECONDS[kind],
      hostLine: kind === "listen-respond" ? hostLine : undefined,
    };
  };

  // Open on the highest-priority due material so the drive starts on the
  // phrases most at risk of being lost.
  const openers = due.length ? due : attention;
  for (const candidate of openers.slice(0, 2)) {
    const activity = makeRetrieval(candidate.phraseId, 0, "due-review");
    if (activity) push(activity, "retrieval");
  }
  retrievalCursor = Math.min(2, rotation.length);

  // A new phrase is heard and echoed early, then retrieved much later.
  const pendingNew: { phraseId: string; readyAt: number }[] = [];
  newPhraseIds.forEach((phraseId, index) => {
    const phrase = phrases.get(phraseId);
    if (!phrase) return;
    push(
      {
        id: `drive.shadow.${phraseId}`,
        kind: "shadow",
        phraseId,
        cueType: "english",
        origin: "new",
        estimatedSeconds: ACTIVITY_SECONDS.shadow,
      },
      "encoding",
    );
    pendingNew.push({
      phraseId,
      readyAt: activities.length + profile.newPhraseGap + index,
    });
  });

  const conversation = buildConversationChain(
    input.scenarios ?? [],
    phrases,
    mastery,
    duration === 10 ? 2 : duration === 15 ? 3 : 4,
  );
  let conversationPlaced = conversation.length === 0;

  while (totalSeconds < budgetSeconds) {
    // Delayed retrieval of anything introduced this drive takes precedence.
    const ready = pendingNew.find((item) => activities.length >= item.readyAt);
    if (ready) {
      pendingNew.splice(pendingNew.indexOf(ready), 1);
      const activity = makeRetrieval(ready.phraseId, 1, "new");
      if (activity) {
        push(activity, "retrieval");
        continue;
      }
    }

    const category = neediestCategory(spent, totalSeconds, profile);

    if (category === "listening") {
      // A conversation chain counts as listening time and lands mid-drive.
      if (!conversationPlaced && totalSeconds > budgetSeconds * 0.45) {
        conversationPlaced = true;
        for (const turn of conversation) push(turn, "listening");
        continue;
      }
      const phraseId = rotation[listeningCursor % Math.max(1, rotation.length)];
      listeningCursor += 1;
      const phrase = phraseId ? phrases.get(phraseId) : undefined;
      if (!phrase) break;
      push(
        {
          id: `drive.listen.${phrase.id}.${listeningCursor}`,
          kind: "listen-meaning",
          phraseId: phrase.id,
          cueType: "spanish-audio",
          origin: "maintenance",
          estimatedSeconds: ACTIVITY_SECONDS["listen-meaning"],
        },
        "listening",
      );
      continue;
    }

    if (!rotation.length) break;
    const phraseId = rotation[retrievalCursor % rotation.length]!;
    const variant = Math.floor(retrievalCursor / rotation.length);
    retrievalCursor += 1;
    const activity = makeRetrieval(
      phraseId,
      variant,
      variant === 0 ? "due-review" : "maintenance",
    );
    if (!activity) break;
    push(activity, "retrieval");
  }

  // Anything introduced but not yet retrieved still gets its delayed recall.
  for (const item of pendingNew) {
    const activity = makeRetrieval(item.phraseId, 1, "new");
    if (activity) push(activity, "retrieval");
  }
  if (!conversationPlaced) for (const turn of conversation) push(turn, "listening");

  return {
    duration,
    activities,
    targetMs,
    wrapAfterMs: Math.max(0, targetMs - WRAP_LEAD_MS),
    dueCount: due.length,
    newPhraseIds,
    closingPhraseId: pickClosingPhrase(mastery, phrases, rotation),
  };
}

function neediestCategory(
  spent: Record<Category, number>,
  total: number,
  profile: Profile,
): Category {
  if (total === 0) return "retrieval";
  const deficit = (category: Category) =>
    profile[category] - spent[category] / total;
  // Encoding is placed explicitly for new phrases, never by ratio drift.
  return deficit("listening") > deficit("retrieval") ? "listening" : "retrieval";
}

/**
 * Pairs a phrase the coach can say with the course phrase that answers it, so
 * "Gracias" can prompt "De nada" without inventing vocabulary. Keyed by the
 * answering phrase id.
 */
export function responsePairs(
  phrases: ReadonlyMap<string, Phrase>,
): Map<string, { esMX: string; english: string }> {
  const byText = new Map<string, string>();
  for (const phrase of phrases.values())
    byText.set(normalizeAnswer(phrase.esMX), phrase.id);

  const pairs = new Map<string, { esMX: string; english: string }>();
  for (const phrase of phrases.values()) {
    const reply = phrase.likelyReplies[0];
    if (!reply) continue;
    const answerId = byText.get(normalizeAnswer(reply.esMX));
    if (!answerId || answerId === phrase.id || pairs.has(answerId)) continue;
    pairs.set(answerId, { esMX: phrase.esMX, english: phrase.english });
  }
  return pairs;
}

/**
 * Conversation chains come from authored scenarios, so they stay inside the
 * learner's vocabulary and can be evaluated deterministically offline.
 */
export function buildConversationChain(
  scenarios: readonly Scenario[],
  phrases: ReadonlyMap<string, Phrase>,
  mastery: ReadonlyMap<string, PhraseMastery>,
  maxTurns: number,
): DriveActivity[] {
  const scenario = scenarios[0];
  if (!scenario || maxTurns <= 0) return [];
  const chain: DriveActivity[] = [];

  for (const turn of scenario.turns) {
    if (turn.speaker !== "learner") continue;
    const phraseId = turn.acceptedPhraseIds.find(
      (id) => phrases.has(id) && mastery.has(id),
    );
    if (!phraseId) continue;
    const host = hostLineBefore(scenario, turn.id);
    chain.push({
      id: `drive.chat.${scenario.id}.${turn.id}`,
      kind: "conversation",
      phraseId,
      cueType: "conversation",
      origin: "maintenance",
      estimatedSeconds: ACTIVITY_SECONDS.conversation,
      hostLine: host,
      chainId: scenario.id,
      chainIntro: chain.length === 0 ? scenario.title : undefined,
    });
    if (chain.length >= maxTurns) break;
  }
  return chain;
}

function hostLineBefore(
  scenario: Scenario,
  learnerTurnId: string,
): { esMX: string; english: string } | undefined {
  const host = scenario.turns.find((turn) => turn.next === learnerTurnId);
  return host && host.speaker === "host"
    ? { esMX: host.line, english: host.meaning }
    : undefined;
}

/**
 * End on something the learner can almost certainly produce, without
 * pretending the rest of the drive went better than it did.
 */
export function pickClosingPhrase(
  mastery: ReadonlyMap<string, PhraseMastery>,
  phrases: ReadonlyMap<string, Phrase>,
  fallbackOrder: readonly string[],
): string | undefined {
  const ranked = [...mastery.entries()]
    .filter(([id]) => phrases.has(id))
    .map(([phraseId, record]) => ({ phraseId, record }))
    .filter(({ record }) => record.independentSuccesses > 0)
    .sort(
      (a, b) =>
        bandRank(memoryBand(b.record)) - bandRank(memoryBand(a.record)) ||
        b.record.independentSuccesses - a.record.independentSuccesses,
    );
  return ranked[0]?.phraseId ?? fallbackOrder[0];
}
