import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { resolveApiBaseUrl } from "../../Recruitement_Workflow/src/services/api-config.mjs";
import authRoutes from "../src/routes/auth.routes.js";
import candidateAuthRoutes from "../src/routes/candidateAuth.routes.js";
import {
  AUTH_RATE_LIMITS,
  candidateLoginRateLimit,
  candidateRegistrationRateLimit,
  createAuthRateLimiter,
  managementLoginRateLimit,
} from "../src/middleware/authRateLimit.middleware.js";

test("API config defaults to localhost in development and permits explicit local HTTP", () => {
  assert.equal(resolveApiBaseUrl(undefined, "development"), "http://localhost:5000/api");
  assert.equal(resolveApiBaseUrl("http://localhost:4100/api", "development"), "http://localhost:4100/api");
});

test("production API config rejects missing, HTTP, invalid, or credential-bearing URLs", () => {
  assert.throws(() => resolveApiBaseUrl(undefined, "production"), /must be configured with HTTPS/);
  assert.throws(() => resolveApiBaseUrl("http://api.example.test/api", "production"), /must use HTTPS/);
  assert.throws(() => resolveApiBaseUrl("not-a-url", "production"), /valid absolute URL/);
  assert.throws(() => resolveApiBaseUrl("https://user:secret@api.example.test/api", "production"), /must not contain credentials/);
  assert.equal(resolveApiBaseUrl("https://api.example.test/api/", "production"), "https://api.example.test/api");
});

function routeHasLimiter(router, path, limiter) {
  const route = router.stack.find((layer) => layer.route?.path === path)?.route;
  return route?.stack.some((layer) => layer.handle === limiter) ?? false;
}

test("only the intended auth endpoints are wired to their rate limits", () => {
  assert.equal(routeHasLimiter(authRoutes, "/login", managementLoginRateLimit), true);
  assert.equal(routeHasLimiter(candidateAuthRoutes, "/login", candidateLoginRateLimit), true);
  assert.equal(routeHasLimiter(candidateAuthRoutes, "/register", candidateRegistrationRateLimit), true);
  assert.equal(routeHasLimiter(authRoutes, "/me", managementLoginRateLimit), false);
});

test("rate limits allow requests below threshold, isolate routes, and return consistent 429 responses", async (t) => {
  const app = express();
  const loginLimiter = createAuthRateLimiter({ windowMs: 60_000, max: 2 });
  app.post("/auth/login", loginLimiter, (_req, res) => res.json({ success: true }));
  app.post("/auth/me", (_req, res) => res.json({ success: true }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;

  for (let count = 0; count < 2; count += 1) {
    const response = await fetch(`${base}/auth/login`, { method: "POST" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
  }

  const unrelated = await fetch(`${base}/auth/me`, { method: "POST" });
  assert.equal(unrelated.status, 200);

  const limited = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "X-Forwarded-For": "203.0.113.99" },
  });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.ok(Number(limited.headers.get("retry-after")) <= 60);
  assert.deepEqual(await limited.json(), {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  });
});

test("authentication limits use the documented thresholds and windows", () => {
  assert.equal(typeof managementLoginRateLimit, "function");
  assert.equal(typeof candidateLoginRateLimit, "function");
  assert.equal(typeof candidateRegistrationRateLimit, "function");
  // Threshold details are intentionally centralized with the exported route middleware.
  assert.deepEqual(AUTH_RATE_LIMITS, {
    managementLogin: { max: 10, windowMs: 900_000 },
    candidateLogin: { max: 10, windowMs: 900_000 },
    candidateRegistration: { max: 5, windowMs: 3_600_000 },
  });
});
