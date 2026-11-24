import test from "node:test";
import assert from "node:assert/strict";
import pool from "../src/config/database.js";
import { updateApplicationProgress } from "../src/repositories/application.repository.js";

function setup(t, application, { failOnStageHistory = false } = {}) {
  const calls = [];
  const tx = { committed: false, rolledBack: false };
  t.mock.method(pool, "getConnection", async () => ({
    beginTransaction: async () => undefined,
    commit: async () => { tx.committed = true; },
    rollback: async () => { tx.rolledBack = true; },
    release: () => undefined,
    execute: async (sql, values) => {
      calls.push({ sql, values });
      if (/SELECT id, status, current_stage FROM applications/.test(sql)) return [[application], []];
      if (/INSERT INTO workflow_history/.test(sql) && failOnStageHistory) throw new Error("history insert failed");
      if (/UPDATE applications/.test(sql)) return [{ affectedRows: 1 }, []];
      return [{ affectedRows: 1 }, []];
    },
  }));
  t.mock.method(pool, "execute", async (sql) => {
    if (/FROM application_status_history h/.test(sql) || /FROM workflow_history h/.test(sql)) return [[], []];
    return [[{ ...application, status: "SCREENING", current_stage: "TECHNICAL_INTERVIEW" }], []];
  });
  return { calls, tx };
}

const update = {
  applicationId: 11,
  organizationId: 4,
  userId: 9,
  status: "SCREENING",
  stage: "TECHNICAL_INTERVIEW",
  decisionComments: null,
  reason: "Technical screen scheduled",
};

test("same-status stage transitions record old/new values, actor, and optional reason", async (t) => {
  const { calls, tx } = setup(t, { id: 11, status: "SCREENING", current_stage: "PHONE_SCREEN" });
  await updateApplicationProgress(update);
  const stageEvent = calls.find(({ sql }) => /INSERT INTO workflow_history/.test(sql));
  assert.ok(stageEvent);
  assert.match(stageEvent.sql, /actor_type, actor_id, reason/);
  assert.deepEqual(stageEvent.values, [4, 11, "PHONE_SCREEN", "TECHNICAL_INTERVIEW", 9, "Technical screen scheduled"]);
  assert.equal(calls.some(({ sql }) => /INSERT INTO application_status_history/.test(sql)), false);
  assert.equal(tx.committed, true);
});

test("unchanged status and stage do not create duplicate history or update rows", async (t) => {
  const { calls, tx } = setup(t, { id: 11, status: "SCREENING", current_stage: "TECHNICAL_INTERVIEW" });
  await updateApplicationProgress(update);
  assert.equal(calls.some(({ sql }) => /UPDATE applications/.test(sql)), false);
  assert.equal(calls.some(({ sql }) => /INSERT INTO (application_status_history|workflow_history)/.test(sql)), false);
  assert.equal(tx.committed, true);
});

test("stage history failure rolls back the associated application update", async (t) => {
  const { calls, tx } = setup(t, { id: 11, status: "SCREENING", current_stage: "PHONE_SCREEN" }, { failOnStageHistory: true });
  await assert.rejects(updateApplicationProgress(update), /history insert failed/);
  assert.ok(calls.some(({ sql }) => /UPDATE applications/.test(sql)));
  assert.equal(tx.rolledBack, true);
  assert.equal(tx.committed, false);
});

test("regressive, unsupported, and terminal-state transitions are rejected", async (t) => {
  for (const [application, request] of [
    [{ id: 11, status: "SCREENING", current_stage: "TECHNICAL_INTERVIEW" }, { ...update, stage: "PHONE_SCREEN" }],
    [{ id: 11, status: "SCREENING", current_stage: "PHONE_SCREEN" }, { ...update, stage: "NOT_A_STAGE" }],
    [{ id: 11, status: "HIRED", current_stage: "HIRED" }, update],
    [{ id: 11, status: "WITHDRAWN", current_stage: "WITHDRAWN" }, update],
  ]) {
    const { calls, tx } = setup(t, application);
    await assert.rejects(updateApplicationProgress(request), { statusCode: 409 });
    assert.equal(calls.some(({ sql }) => /UPDATE applications|INSERT INTO/.test(sql)), false);
    assert.equal(tx.rolledBack, true);
    t.mock.restoreAll();
  }
});

test("shortlisting requires a screening stage and rejection moves an active application to terminal state", async (t) => {
  const invalid = setup(t, { id: 11, status: "APPLIED", current_stage: "APPLICATION" });
  await assert.rejects(updateApplicationProgress({ ...update, status: "SHORTLISTED", stage: "SHORTLISTED" }), { statusCode: 409 });
  assert.equal(invalid.tx.rolledBack, true);
  t.mock.restoreAll();

  const rejected = setup(t, { id: 11, status: "APPLIED", current_stage: "APPLICATION" });
  await updateApplicationProgress({ ...update, status: "REJECTED", stage: "REJECTED", reason: "Role closed", decisionComments: "Role closed" });
  assert.ok(rejected.calls.some(({ sql, values }) => /INSERT INTO application_status_history/.test(sql) && values.includes("REJECTED")));
  assert.ok(rejected.calls.some(({ sql, values }) => /INSERT INTO workflow_history/.test(sql) && values.includes("REJECTED")));
  assert.equal(rejected.tx.committed, true);
});
