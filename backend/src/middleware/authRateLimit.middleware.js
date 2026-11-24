const TOO_MANY_ATTEMPTS = {
  success: false,
  message: "Too many authentication attempts. Please try again later.",
};

/**
 * In-memory, per-IP fixed-window limiter for public authentication routes.
 * Express proxy trust is intentionally left disabled by default, so req.ip
 * comes from the direct socket unless deployment explicitly configures a
 * trusted proxy.
 */
export function createAuthRateLimiter({ windowMs, max, now = Date.now }) {
  const requestsByIp = new Map();

  return function authRateLimit(req, res, next) {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const currentTime = now();
    let record = requestsByIp.get(key);

    if (!record || record.resetAt <= currentTime) {
      record = { count: 0, resetAt: currentTime + windowMs };
      requestsByIp.set(key, record);
    }

    record.count += 1;
    if (record.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - currentTime) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json(TOO_MANY_ATTEMPTS);
    }

    // Bound memory if a process receives many distinct source addresses.
    if (requestsByIp.size > 10_000) {
      for (const [ip, entry] of requestsByIp) {
        if (entry.resetAt <= currentTime) requestsByIp.delete(ip);
      }
      if (requestsByIp.size > 10_000) {
        const oldestIp = requestsByIp.keys().next().value;
        if (oldestIp !== undefined) requestsByIp.delete(oldestIp);
      }
    }

    return next();
  };
}

export const AUTH_RATE_LIMITS = Object.freeze({
  managementLogin: Object.freeze({ windowMs: 15 * 60 * 1000, max: 10 }),
  candidateLogin: Object.freeze({ windowMs: 15 * 60 * 1000, max: 10 }),
  candidateRegistration: Object.freeze({ windowMs: 60 * 60 * 1000, max: 5 }),
});

export const managementLoginRateLimit = createAuthRateLimiter(AUTH_RATE_LIMITS.managementLogin);
export const candidateLoginRateLimit = createAuthRateLimiter(AUTH_RATE_LIMITS.candidateLogin);
export const candidateRegistrationRateLimit = createAuthRateLimiter(AUTH_RATE_LIMITS.candidateRegistration);
