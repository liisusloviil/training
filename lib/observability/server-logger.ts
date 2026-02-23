export function logCriticalError(
  scope: string,
  error: unknown,
  meta?: Record<string, unknown>,
) {
  const payload = {
    level: "error",
    scope,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    meta: meta ?? {},
    timestamp: new Date().toISOString(),
  };

  console.error("[mvp-critical]", JSON.stringify(payload));
}
