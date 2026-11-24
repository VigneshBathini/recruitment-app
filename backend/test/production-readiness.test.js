import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { createApp } from "../src/app.js";
import { createDatabaseConfig, validateProductionEnvironment } from "../src/config/production-config.js";
import { startServer } from "../src/server-lifecycle.js";

const productionEnv = {
  NODE_ENV: "production",
  DB_HOST: "mysql.example.test",
  DB_NAME: "recruitment",
  DB_USER: "service",
  DB_PASSWORD: "test-only-secret",
  JWT_SECRET: "test-only-jwt-secret",
};

test("production startup rejects missing TLS CA configuration", () => {
  assert.throws(() => validateProductionEnvironment(productionEnv), /DB_TLS_CA_FILE/);
});

test("production startup rejects invalid or unreadable TLS CA configuration", () => {
  assert.throws(
    () => validateProductionEnvironment({ ...productionEnv, DB_TLS_CA_FILE: "missing-test-ca.pem" }, () => {
      throw new Error("path must not appear in public error");
    }),
    /TLS CA configuration is invalid or unreadable/
  );
  assert.throws(
    () => validateProductionEnvironment({ ...productionEnv, DB_TLS_CA_FILE: "invalid.pem" }, () => "not a certificate"),
    /TLS CA configuration is invalid or unreadable/
  );
});

test("production database configuration validates required settings without exposing values", () => {
  assert.throws(() => validateProductionEnvironment({ NODE_ENV: "production", DB_HOST: "secret-host" }), /DB_NAME/);
  assert.throws(() => validateProductionEnvironment({ ...productionEnv, DB_PASSWORD: "" }), /DB_PASSWORD/);
  assert.throws(() => validateProductionEnvironment({ ...productionEnv, JWT_SECRET: "" }), /JWT_SECRET/);
});

test("development database configuration continues without TLS", () => {
  const config = createDatabaseConfig({
    NODE_ENV: "development", DB_HOST: "localhost", DB_PORT: "3306", DB_NAME: "local", DB_USER: "dev", DB_PASSWORD: "dev",
  });
  assert.equal(config.host, "localhost");
  assert.equal(config.ssl, undefined);
});

test("production database configuration requires certificate verification", () => {
  const config = createDatabaseConfig(productionEnv, () => ({ ca: "trusted test CA", rejectUnauthorized: true }));
  assert.deepEqual(config.ssl, { ca: "trusted test CA", rejectUnauthorized: true });
});

test("health endpoints return minimal status and never expose raw database errors", async (t) => {
  const app = createApp({ database: { query: async () => { throw new Error("password=secret host=mysql.internal stack trace"); } } });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;

  const live = await fetch(`${base}/api/health`);
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { success: true, message: "Recruitment Workflow API is running" });

  const readiness = await fetch(`${base}/api/health/db`);
  assert.equal(readiness.status, 500);
  const body = await readiness.text();
  assert.equal(body, JSON.stringify({ success: false, message: "Service temporarily unavailable" }));
  assert.doesNotMatch(body, /secret|mysql\.internal|stack trace/i);
});

test("graceful shutdown handles signals once and closes the server and pool", async () => {
  const processObject = new EventEmitter();
  let closeCalls = 0;
  let poolCloseCalls = 0;
  const fakeApp = { listen: () => ({
    close(callback) { closeCalls += 1; callback(); },
    closeAllConnections() {},
  }) };
  const lifecycle = startServer({
    app: fakeApp,
    pool: { async end() { poolCloseCalls += 1; } },
    port: 0,
    processObject,
    logger: { info() {}, error() {} },
  });

  processObject.emit("SIGTERM");
  processObject.emit("SIGINT");
  await lifecycle.shutdown("SIGINT");
  assert.equal(closeCalls, 1);
  assert.equal(poolCloseCalls, 1);
  assert.equal(processObject.listenerCount("SIGTERM"), 0);
  assert.equal(processObject.listenerCount("SIGINT"), 0);
});

