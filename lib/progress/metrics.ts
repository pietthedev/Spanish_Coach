export const readinessCategories = [
  "Foundations",
  "Food",
  "Money",
  "Transport",
  "Directions",
  "Stay",
  "Problems",
  "Friendly chat",
] as const;
export type ReadinessState =
  "Not started" | "Building" | "Practised" | "Trip-ready";

export function foundationsReadiness(
  completedLessons: number,
  successfulAttempts: number,
  missionCompleted: boolean,
): ReadinessState {
  if (completedLessons === 0) return "Not started";
  if (missionCompleted && completedLessons >= 7 && successfulAttempts >= 12)
    return "Trip-ready";
  if (completedLessons >= 4 && successfulAttempts >= 6) return "Practised";
  return "Building";
}

export function departureCountdown(now: Date): number {
  const departure = Date.UTC(2026, 9, 20);
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.max(0, Math.ceil((departure - today) / 86_400_000));
}

export function calculateRhythm(
  activeDates: string[],
  today: string,
): { current: number; longest: number; totalDays: number } {
  const unique = [...new Set(activeDates)].sort();
  let longest = 0;
  let run = 0;
  let previous: Date | undefined;
  for (const value of unique) {
    const date = new Date(`${value}T00:00:00Z`);
    if (!previous) run = 1;
    else {
      const gap = Math.round(
        (date.getTime() - previous.getTime()) / 86_400_000,
      );
      run = gap <= 2 ? run + 1 : 1;
    }
    longest = Math.max(longest, run);
    previous = date;
  }
  const last = unique.at(-1);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const current =
    last &&
    (todayDate.getTime() - new Date(`${last}T00:00:00Z`).getTime()) /
      86_400_000 <=
      2
      ? run
      : 0;
  return { current, longest, totalDays: unique.length };
}
