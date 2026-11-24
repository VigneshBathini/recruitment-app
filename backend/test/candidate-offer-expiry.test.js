import test from "node:test";
import assert from "node:assert/strict";
import pool from "../src/config/database.js";
import { respondToCandidateOffer } from "../src/repositories/candidate-offer.repository.js";

test("an expired issued offer cannot be accepted", async (t) => {
  const calls = [];
  const transaction = { rolledBack: false, committed: false };
  t.mock.method(pool, "getConnection", async () => ({
    beginTransaction: async () => undefined,
    commit: async () => { transaction.committed = true; },
    rollback: async () => { transaction.rolledBack = true; },
    release: () => undefined,
    execute: async (sql, values) => {
      calls.push({ sql, values });
      if (/SELECT o\.id, o\.status, o\.candidate_responded_at/.test(sql)) {
        return [[{ id: 4, status: "ISSUED", candidate_responded_at: null, expired: 1 }], []];
      }
      assert.fail("An expired offer must not be updated");
    },
  }));

  const result = await respondToCandidateOffer(4, 12, 3, "ACCEPTED", null);
  assert.deepEqual(result, { error: "expired" });
  assert.equal(transaction.rolledBack, true);
  assert.equal(transaction.committed, false);
  assert.match(calls[0].sql, /o\.expiry_date < CURRENT_DATE/);
  assert.deepEqual(calls[0].values, [4, 3, 12]);
});

test("an expired issued offer cannot be declined", async (t) => {
  const transaction = { rolledBack: false };
  t.mock.method(pool, "getConnection", async () => ({
    beginTransaction: async () => undefined,
    commit: async () => assert.fail("Expired offers must not commit"),
    rollback: async () => { transaction.rolledBack = true; },
    release: () => undefined,
    execute: async (sql) => {
      if (/SELECT o\.id, o\.status, o\.candidate_responded_at/.test(sql)) return [[{ id: 4, status: "ISSUED", candidate_responded_at: null, expired: 1 }], []];
      assert.fail("An expired offer must not be updated");
    },
  }));
  assert.deepEqual(await respondToCandidateOffer(4, 12, 3, "DECLINED", null), { error: "expired" });
  assert.equal(transaction.rolledBack, true);
});

test("an offer remains answerable through its expiry date", async (t) => {
  const calls = [];
  t.mock.method(pool, "getConnection", async () => ({
    beginTransaction: async () => undefined,
    commit: async () => undefined,
    rollback: async () => assert.fail("Expiry date inclusive boundary must not roll back"),
    release: () => undefined,
    execute: async (sql, values) => {
      calls.push({ sql, values });
      if (/SELECT o\.id, o\.status, o\.candidate_responded_at/.test(sql)) return [[{ id: 4, status: "ISSUED", candidate_responded_at: null, expired: 0 }], []];
      if (/UPDATE offers/.test(sql)) return [{ affectedRows: 1 }, []];
      assert.fail(`Unexpected transaction query: ${sql}`);
    },
  }));
  t.mock.method(pool, "execute", async (sql) => {
    assert.match(sql, /o\.expiry_date < CURRENT_DATE/);
    return [[{ id: 4, status: "ACCEPTED" }], []];
  });
  const result = await respondToCandidateOffer(4, 12, 3, "ACCEPTED", null);
  assert.equal(result.offer.status, "ACCEPTED");
  const update = calls.find(({ sql }) => /UPDATE offers/.test(sql));
  assert.match(update.sql, /expiry_date >= CURRENT_DATE/);
});

test("expiry crossed during response update is rejected after the atomic date guard", async (t) => {
  const calls = [];
  const transaction = { rolledBack: false, committed: false };
  t.mock.method(pool, "getConnection", async () => ({
    beginTransaction: async () => undefined,
    commit: async () => { transaction.committed = true; },
    rollback: async () => { transaction.rolledBack = true; },
    release: () => undefined,
    execute: async (sql, values) => {
      calls.push({ sql, values });
      if (/SELECT o\.id, o\.status, o\.candidate_responded_at/.test(sql)) return [[{ id: 4, status: "ISSUED", candidate_responded_at: null, expired: 0 }], []];
      if (/UPDATE offers/.test(sql)) return [{ affectedRows: 0 }, []];
      if (/SELECT \(o\.expiry_date IS NOT NULL/.test(sql)) return [[{ expired: 1, application_status: "SHORTLISTED" }], []];
      assert.fail(`Unexpected transaction query: ${sql}`);
    },
  }));
  const result = await respondToCandidateOffer(4, 12, 3, "DECLINED", null);
  assert.deepEqual(result, { error: "expired" });
  assert.equal(transaction.rolledBack, true);
  assert.equal(transaction.committed, false);
  const guardedUpdate = calls.find(({ sql }) => /UPDATE offers/.test(sql));
  assert.match(guardedUpdate.sql, /expiry_date >= CURRENT_DATE/);
});
