import type { MiddlewareHandler } from "hono";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const MAX_TRACKED_KEYS = 10_000;

/** Source and username → attempt timestamps (ms). */
const attemptsByIp = new Map<string, number[]>();

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  // A public client can forge X-Forwarded-For. Only honor it when the
  // deployment explicitly declares that a trusted proxy has normalized it.
  const forwarded = process.env.TRUST_PROXY === "true" ? c.req.header("x-forwarded-for") : undefined;
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return process.env.TRUST_PROXY === "true" ? (c.req.header("x-real-ip") ?? "unknown") : "direct";
}

function recordAttempt(key: string, now: number): boolean {
  for (const [candidate, timestamps] of attemptsByIp) {
    const recent = timestamps.filter((t) => now - t < WINDOW_MS);
    if (recent.length === 0) attemptsByIp.delete(candidate);
    else if (recent.length !== timestamps.length) attemptsByIp.set(candidate, recent);
  }
  while (attemptsByIp.size >= MAX_TRACKED_KEYS && !attemptsByIp.has(key)) {
    const oldest = attemptsByIp.keys().next().value;
    if (oldest === undefined) break;
    attemptsByIp.delete(oldest);
  }

  const recent = attemptsByIp.get(key) ?? [];
  if (recent.length >= MAX_ATTEMPTS) return false;
  recent.push(now);
  attemptsByIp.set(key, recent);
  return true;
}

/** Clear rate-limit state (tests). */
export function resetLoginRateLimit(): void {
  attemptsByIp.clear();
}

/**
 * In-memory login rate limit: 20 attempts / 15 minutes per IP → 429.
 */
export function rateLimitLogin(username: string): MiddlewareHandler {
  return async (c, next) => {
    const ip = clientIp(c);
    const now = Date.now();
    // A forged source header cannot bypass the per-account limit.
    const allowedByUser = recordAttempt(`user:${username}`, now);
    const allowedBySource = recordAttempt(`source:${ip}`, now);
    if (!allowedByUser || !allowedBySource) {
      return c.json({ error: "登录尝试次数过多，请稍后再试" }, 429);
    }
    await next();
  };
}
