const buckets = new Map<string, { startedAt: number; count: number }>();
export function checkRateLimit(
  key: string,
  limit: number,
  now = Date.now(),
): boolean {
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
export function resetRateLimits() {
  buckets.clear();
}
