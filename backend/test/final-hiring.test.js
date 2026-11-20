import test from "node:test";
import assert from "node:assert/strict";
import pool from "../src/config/database.js";
import { completeOnboardingService } from "../src/services/onboarding.service.js";
import { parseApplicationListQuery, moveApplicationToStageService } from "../src/services/application.service.js";

const user = { id: 27, organization_id: 8, role_id: 2 };
const validRecord = {
  onboarding_id: 1, organization_id: 8, application_id: 5,
  onboarding_status: "READY_TO_JOIN", application_status: "SHORTLISTED",
  decision: "SELECTED", offer_status: "ACCEPTED",
};

function mockHiringDatabase(t, { record = validRecord, permissions = [{ name: "onboarding.complete" }], failOnHistory = false } = {}) {
  const calls = [];
  const transaction = { committed: false, rolledBack: false };
  t.mock.method(pool, "execute", async (sql) => /organization_role_permissions/.test(sql) ? [permissions, []] : [[], []]);
  t.mock.method(pool, "getConnection", async () => ({
    beginTransaction: async () => { transaction.started = true; },
    commit: async () => { transaction.committed = true; },
    rollback: async () => { transaction.rolledBack = true; },
    release: () => { transaction.released = true; },
    execute: async (sql, values) => {
      calls.push({ sql, values });
      if (/SELECT ob\.id AS onboarding_id/.test(sql)) return [[...(record ? [record] : [])], []];
      if (/UPDATE applications SET status = 'HIRED'/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/INSERT INTO application_status_history/.test(sql) && failOnHistory) throw new Error("history insert failed");
      if (/SELECT ob\.id, ob\.organization_id/.test(sql)) return [[{ id: 1, organization_id: 8, application_id: 5, status: "COMPLETED", completed_at: "2026-11-20" }], []];
      return [{ affectedRows: 1 }, []];
    },
  }));
  return { calls, transaction };
}

test("final hiring completes legacy demo onboarding and records HIRED history in one transaction", async (t) => {
  const legacyDemo = { ...validRecord, onboarding_status: "COMPLETED" };
  const { calls, transaction } = mockHiringDatabase(t, { record: legacyDemo });
  const result = await completeOnboardingService(1, user);
  assert.equal(result.onboarding.status, "COMPLETED");
  assert.equal(transaction.committed, true);
  assert.equal(transaction.rolledBack, false);
  assert.ok(calls.some(({ sql, values }) => /UPDATE applications SET status = 'HIRED'/.test(sql) && values.includes(5) && values.includes(8)));
  assert.ok(calls.some(({ sql }) => /INSERT INTO application_status_history/.test(sql)));
  assert.ok(calls.some(({ sql }) => /UPDATE onboarding_records SET status = 'COMPLETED'/.test(sql)));
  assert.equal(calls.some(({ sql }) => /employees/i.test(sql)), false);
});

test("future final hiring requires READY_TO_JOIN and valid decision and offer", async (t) => {
  for (const changed of [{ decision: "REJECTED" }, { offer_status: "ISSUED" }, { onboarding_status: "IN_PROGRESS" }]) {
    const { calls, transaction } = mockHiringDatabase(t, { record: { ...validRecord, ...changed } });
    await assert.rejects(completeOnboardingService(1, user), { statusCode: 409 });
    assert.equal(transaction.committed, false);
    assert.equal(calls.some(({ sql }) => /UPDATE applications SET status = 'HIRED'/.test(sql)), false);
    t.mock.restoreAll();
  }
});

test("already hired applications cannot be finalized again", async (t) => {
  const { calls, transaction } = mockHiringDatabase(t, { record: { ...validRecord, application_status: "HIRED" } });
  await assert.rejects(completeOnboardingService(1, user), { statusCode: 409 });
  assert.equal(transaction.committed, false);
  assert.equal(calls.some(({ sql }) => /INSERT INTO application_status_history/.test(sql)), false);
});

test("a database error rolls application, history and onboarding changes back", async (t) => {
  const { transaction } = mockHiringDatabase(t, { failOnHistory: true });
  await assert.rejects(completeOnboardingService(1, user), /history insert failed/);
  assert.equal(transaction.rolledBack, true);
  assert.equal(transaction.committed, false);
});

test("final hiring is tenant-scoped and requires onboarding.complete", async (t) => {
  const { calls } = mockHiringDatabase(t, { record: null });
  await assert.rejects(completeOnboardingService(1, user), { statusCode: 404 });
  const select = calls.find(({ sql }) => /SELECT ob\.id AS onboarding_id/.test(sql));
  assert.match(select.sql, /ob\.id = \? AND ob\.organization_id = \?/);
  assert.deepEqual(select.values, [1, user.organization_id]);
  t.mock.restoreAll();
  const { transaction } = mockHiringDatabase(t, { permissions: [] });
  await assert.rejects(completeOnboardingService(1, user), { statusCode: 403 });
  assert.equal(transaction.started, undefined);
});

test("HIRED is filterable and normal application stage updates cannot move hired applications backwards", async (t) => {
  assert.equal(parseApplicationListQuery({ status: "HIRED" }).status, "HIRED");
  const transaction = { rolledBack: false };
  t.mock.method(pool, "getConnection", async () => ({
    beginTransaction: async () => undefined,
    rollback: async () => { transaction.rolledBack = true; },
    commit: async () => assert.fail("A hired application must not be updated"),
    release: () => undefined,
    execute: async () => [[{ id: 5, status: "HIRED", current_stage: "HIRED" }], []],
  }));
  await assert.rejects(moveApplicationToStageService(5, { stage: "SCREENING" }, user), { statusCode: 409 });
  assert.equal(transaction.rolledBack, true);
});
