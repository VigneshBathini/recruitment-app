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
