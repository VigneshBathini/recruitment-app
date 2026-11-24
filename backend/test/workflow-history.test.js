import test from "node:test";
import assert from "node:assert/strict";
import pool from "../src/config/database.js";
import { createInterview, changeInterview } from "../src/repositories/interview.repository.js";
import { updateOnboardingRecord, updateOnboardingTask } from "../src/repositories/onboarding.repository.js";
import { historyService as interviewHistoryService } from "../src/services/interview.service.js";
import { getOnboardingHistoryService } from "../src/services/onboarding.service.js";

function mockConnection(t, execute) {
  const calls = [];
  const tx = { committed: false, rolledBack: false };
  t.mock.method(pool, "getConnection", async () => ({
    beginTransaction: async () => undefined,
    commit: async () => { tx.committed = true; },
    rollback: async () => { tx.rolledBack = true; },
    release: () => undefined,
    execute: async (sql, values) => { calls.push({ sql, values }); return execute(sql, values); },
  }));
  return { calls, tx };
}

test("interview creation and rescheduling store actor and previous schedule transactionally", async (t) => {
  const { calls, tx } = mockConnection(t, async (sql) => {
    if (/SELECT id FROM users/.test(sql)) return [[{ id: 15 }], []];
    if (/SELECT id FROM applications/.test(sql)) return [[{ id: 31 }], []];
    if (/INSERT INTO interviews/.test(sql)) return [{ insertId: 44 }, []];
    if (/SELECT i\.scheduled_at, i\.status/.test(sql)) return [[{ scheduled_at: "2026-12-01 10:00:00", status: "SCHEDULED" }], []];
    return [{ affectedRows: 1 }, []];
  });
  await createInterview({ application_id: 31, organization_id: 6, created_by: 12, panel_member_ids: [15], interview_type: "TECHNICAL", title: "Interview", scheduled_at: "2026-12-01T10:00:00", duration_minutes: 30 });
  await changeInterview(44, 6, { scheduled_at: "2026-12-02T11:00:00" }, 12);
  const events = calls.filter(({ sql }) => /INSERT INTO workflow_history/.test(sql));
  assert.equal(events.length, 2);
  assert.deepEqual(events[0].values, [6, 44, "2026-12-01T10:00:00", 12]);
  assert.match(events[0].sql, /'CREATED'/);
  assert.deepEqual(events[1].values, [6, 44, "2026-12-01 10:00:00", "2026-12-02T11:00:00", 12]);
  assert.match(events[1].sql, /'RESCHEDULED'/);
  assert.equal(tx.committed, true);
});

test("interview cancellation stores previous status and actor", async (t) => {
  const { calls } = mockConnection(t, async (sql) => {
    if (/SELECT i\.scheduled_at, i\.status/.test(sql)) return [[{ scheduled_at: "2026-12-01 10:00:00", status: "SCHEDULED" }], []];
    return [{ affectedRows: 1 }, []];
  });
  await changeInterview(44, 6, { status: "CANCELLED" }, 12);
  const event = calls.find(({ sql }) => /INSERT INTO workflow_history/.test(sql));
  assert.deepEqual(event.values, [6, 44, "SCHEDULED", 12]);
  assert.match(event.sql, /'CANCELLED'/);
});

test("onboarding and task status changes store old/new status and actor", async (t) => {
  const { calls } = mockConnection(t, async (sql) => {
    if (/SELECT id, status FROM onboarding_records/.test(sql)) return [[{ id: 9, status: "INITIATED" }], []];
    if (/SELECT t\.\*, ob\.candidate_id/.test(sql)) return [[{ id: 20, onboarding_id: 9, organization_id: 6, candidate_id: 50, status: "PENDING", assigned_to_candidate_id: 50, assigned_to_user_id: null }], []];
    return [{ affectedRows: 1 }, []];
  });
  await updateOnboardingRecord(9, 6, { status: "IN_PROGRESS", actorId: 12 });
  await updateOnboardingTask(20, 6, { status: "IN_PROGRESS" }, { candidateId: 50 });
  const events = calls.filter(({ sql }) => /INSERT INTO workflow_history/.test(sql));
  assert.deepEqual(events[0].values, [6, 9, "INITIATED", "IN_PROGRESS", 12]);
  assert.deepEqual(events[1].values, [6, 20, "PENDING", "IN_PROGRESS", "CANDIDATE", 50]);
});

test("interview history requires recruiter or Hiring Manager and stays organization-scoped", async (t) => {
  const calls = [];
  t.mock.method(pool, "execute", async (sql, values) => {
    calls.push({ sql, values });
    if (/SELECT i\.id, i\.application_id/.test(sql)) return [values[1] === 6 ? [{ id: 44, application_id: 31, organization_id: 6 }] : [], []];
    if (/FROM interview_panel_members/.test(sql) || /FROM interview_feedback/.test(sql)) return [[], []];
    if (/FROM workflow_history/.test(sql)) return [[{ id: 1, action: "CREATED" }], []];
    assert.fail(`Unexpected SQL: ${sql}`);
  });
  await assert.rejects(interviewHistoryService(44, { id: 1, organization_id: 6, role_name: "Interviewer" }), { statusCode: 403 });
  assert.equal(calls.length, 0);
  const rows = await interviewHistoryService(44, { id: 12, organization_id: 6, role_name: "Hiring Manager" });
  assert.equal(rows[0].action, "CREATED");
  const historyQuery = calls.find(({ sql }) => /FROM workflow_history/.test(sql));
  assert.match(historyQuery.sql, /h\.organization_id = \?/);
  assert.deepEqual(historyQuery.values, [6, 44]);
  await assert.rejects(interviewHistoryService(44, { id: 12, organization_id: 99, role_name: "Recruiter" }), { statusCode: 404 });
});

test("onboarding history requires a management permission and enforces tenant ownership", async (t) => {
  const calls = [];
  t.mock.method(pool, "execute", async (sql, values) => {
    calls.push({ sql, values });
    if (/FROM permissions p/.test(sql)) return [[{ name: "onboarding.view" }], []];
    if (/FROM onboarding_records ob/.test(sql) && /WHERE ob\.id/.test(sql)) return [values[1] === 6 ? [{ id: 9, organization_id: 6 }] : [], []];
    if (/FROM workflow_history h/.test(sql)) return [[{ id: 1, action: "STATUS_CHANGED" }], []];
    assert.fail(`Unexpected SQL: ${sql}`);
  });
  const history = await getOnboardingHistoryService(9, { id: 12, organization_id: 6, role_id: 2 });
  assert.equal(history[0].action, "STATUS_CHANGED");
  const historyQuery = calls.find(({ sql }) => /FROM workflow_history h/.test(sql));
  assert.match(historyQuery.sql, /h\.organization_id = \?/);
  assert.match(historyQuery.sql, /t\.onboarding_id = ob\.id/);
  assert.deepEqual(historyQuery.values, [9, 6]);
  await assert.rejects(getOnboardingHistoryService(9, { id: 12, organization_id: 99, role_id: 2 }), { statusCode: 404 });

  t.mock.restoreAll();
  t.mock.method(pool, "execute", async (sql) => {
    if (/FROM permissions p/.test(sql)) return [[{ name: "application.view" }], []];
    assert.fail(`History must be denied before querying records: ${sql}`);
  });
  await assert.rejects(getOnboardingHistoryService(9, { id: 12, organization_id: 6, role_id: 2 }), { statusCode: 403 });
});
