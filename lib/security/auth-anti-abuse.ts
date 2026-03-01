type AuthScope = "login" | "register";

type AuthAttemptContext = {
  scope: AuthScope;
  requestHeaders: { get(name: string): string | null };
  login: string;
};

type AttemptBucket = {
  failures: number[];
  blockedUntil: number;
};

const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 5 * 60 * 1000;
const MAX_FAILURES_PER_WINDOW = 8;

const buckets = new Map<string, AttemptBucket>();

function normalizeLogin(login: string): string {
  return login.trim().toLowerCase().slice(0, 160);
}

function resolveClientIp(requestHeaders: { get(name: string): string | null }): string {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    firstForwardedIp ??
    requestHeaders.get("x-real-ip")?.trim() ??
    requestHeaders.get("cf-connecting-ip")?.trim() ??
    "unknown"
  );
}

function buildAttemptKey(context: AuthAttemptContext): string {
  const ip = resolveClientIp(context.requestHeaders);
  return `${context.scope}:${ip}:${normalizeLogin(context.login)}`;
}

function getFreshFailures(timestamps: number[], now: number): number[] {
  return timestamps.filter((time) => now - time <= WINDOW_MS);
}

export function isAuthAttemptBlocked(context: AuthAttemptContext): boolean {
  const key = buildAttemptKey(context);
  const bucket = buckets.get(key);

  if (!bucket) {
    return false;
  }

  const now = Date.now();
  const freshFailures = getFreshFailures(bucket.failures, now);
  const isBlocked = bucket.blockedUntil > now;

  if (!freshFailures.length && !isBlocked) {
    buckets.delete(key);
    return false;
  }

  buckets.set(key, {
    failures: freshFailures,
    blockedUntil: bucket.blockedUntil,
  });

  return isBlocked;
}

export function registerAuthFailure(context: AuthAttemptContext): void {
  const key = buildAttemptKey(context);
  const now = Date.now();
  const existing = buckets.get(key);
  const freshFailures = getFreshFailures(existing?.failures ?? [], now);
  freshFailures.push(now);

  const shouldBlock = freshFailures.length >= MAX_FAILURES_PER_WINDOW;

  buckets.set(key, {
    failures: freshFailures,
    blockedUntil: shouldBlock ? now + BLOCK_MS : existing?.blockedUntil ?? 0,
  });
}

export function clearAuthFailures(context: AuthAttemptContext): void {
  buckets.delete(buildAttemptKey(context));
}
