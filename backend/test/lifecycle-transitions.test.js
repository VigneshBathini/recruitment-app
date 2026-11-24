import test from "node:test";
import assert from "node:assert/strict";
import pool from "../src/config/database.js";
import {
  submitRequirement,
  approveRequirement,
  rejectRequirement,
} from "../src/repositories/requirement.repository.js";
import {
  createJobDescriptionFromRequirement,
  publishJobDescription,
} from "../src/repositories/jobDescription.repository.js";
import { updateApplicationProgress } from "../src/repositories/application.repository.js";
import { feedbackService } from "../src/services/interview.service.js";

function mockConnection(t, execute) {
  const calls = [];
  const tx = { committed: false, rolledBack: false };
  t.mock.method(pool, "getConnection", async () => ({
    beginTransaction: async () => undefined,
    commit: async () => { tx.committed = true; },
    rollback: async () => { tx.rolledBack = true; },
    release: () => undefined,
    execute: async (sql, values) => {
      calls.push({ sql, values });
      return execute(sql, values);
    },
  }));
  return { calls, tx };
}

test("requirement submission, approval and rejection are org-scoped conditional transitions", async (t) => {
  const calls = [];
  t.mock.method(pool, "execute", async (sql, values) => {
    calls.push({ sql, values });
    if (/UPDATE job_requirements/.test(sql)) return [{ affectedRows: 1 }, []];
    return [[{ id: 4, organization_id: values.at(-1), status: "PENDING_APPROVAL" }], []];
  });
  await submitRequirement(4, 17);
  await approveRequirement(4, 17, 8);
  await rejectRequirement(4, 17, 8, "Budget not approved");
  assert.equal(calls.length, 6);
  for (const { sql, values } of calls.filter(({ sql }) => /UPDATE job_requirements/.test(sql))) {
    assert.match(sql, /organization_id = \?/);
    assert.match(sql, /status IN \('DRAFT', 'REJECTED'\)|status = 'PENDING_APPROVAL'/);
    assert.ok(values.includes(17));
  }
});

test("JD creation rejects unapproved and cross-organization requirements", async (t) => {
  for (const requirement of [null, { id: 4, title: "Engineer", description: "", status: "PENDING_APPROVAL" }]) {
    const { calls, tx } = mockConnection(t, async (sql, values) => {
      if (/FROM job_requirements/.test(sql)) {
        assert.match(sql, /id = \? AND organization_id = \?/);
        assert.deepEqual(values, [4, 17]);
        return [requirement ? [requirement] : [], []];
      }
      assert.fail(`JD creation continued unexpectedly: ${sql}`);
    });
    await assert.rejects(createJobDescriptionFromRequirement(4, 17), (error) => [404, 409].includes(error.statusCode));
    assert.equal(calls.length, 1);
    assert.equal(tx.rolledBack, true);
    t.mock.restoreAll();
  }
});

test("JD publication requires approved state and an organization-owned row", async (t) => {
  const { calls, tx } = mockConnection(t, async (sql, values) => {
    if (/SELECT id, status FROM jobs/.test(sql)) {
      assert.match(sql, /id = \? AND organization_id = \?/);
      assert.deepEqual(values, [21, 17]);
      return [[{ id: 21, status: "PENDING_APPROVAL" }], []];
    }
    assert.fail(`Unapproved JD must not be published: ${sql}`);
  });
  await assert.rejects(publishJobDescription(21, 17), { statusCode: 409 });
  assert.equal(tx.rolledBack, true);
  assert.equal(calls.length, 1);
});

test("application progress writes status and history atomically and refuses final-state regressions", async (t) => {
  const { calls, tx } = mockConnection(t, async (sql) => {
    if (/SELECT id, status, current_stage FROM applications/.test(sql)) return [[{ id: 6, status: "APPLIED", current_stage: "APPLICATION" }], []];
    if (/UPDATE applications/.test(sql)) return [{ affectedRows: 1 }, []];
    if (/INSERT INTO application_status_history/.test(sql)) return [{ affectedRows: 1 }, []];
    if (/INSERT INTO workflow_history/.test(sql)) return [{ affectedRows: 1 }, []];
    assert.fail(`Unexpected SQL: ${sql}`);
  });
  t.mock.method(pool, "execute", async (sql, values) => {
    if (/FROM application_status_history h|FROM workflow_history h/.test(sql)) {
      if (/FROM workflow_history h/.test(sql)) return [[], []];
      assert.match(sql, /a\.organization_id = \?/);
      assert.deepEqual(values, [17, 6]);
      return [[], []];
    }
    assert.match(sql, /WHERE a\.id = \? AND a\.organization_id = \?/);
    assert.deepEqual(values, [6, 17]);
    return [[{ id: 6, status: "SCREENING" }], []];
  });
  const updated = await updateApplicationProgress({ applicationId: 6, organizationId: 17, userId: 8, status: "SCREENING", stage: "PHONE_SCREEN" });
  assert.equal(updated.status, "SCREENING");
  assert.deepEqual(calls.find(({ sql }) => /INSERT INTO application_status_history/.test(sql)).values, [6, "APPLIED", "SCREENING", 8, 8, null]);
  assert.equal(tx.committed, true);

  t.mock.restoreAll();
  const blocked = mockConnection(t, async (sql) => {
    if (/SELECT id, status, current_stage FROM applications/.test(sql)) return [[{ id: 6, status: "REJECTED", current_stage: "REJECTED" }], []];
    assert.fail(`Final applications must not be mutated: ${sql}`);
  });
  await assert.rejects(updateApplicationProgress({ applicationId: 6, organizationId: 17, userId: 8, status: "SCREENING", stage: "SCREENING" }), { statusCode: 409 });
  assert.equal(blocked.tx.rolledBack, true);
});

test("only interviewer accounts can submit feedback; invalid roles are rejected before database access", async (t) => {
  t.mock.method(pool, "execute", async () => assert.fail("Unauthorized feedback must not query the database"));
  await assert.rejects(feedbackService(3, { rating: 5, recommendation: "HIRE" }, {
    id: 8, organization_id: 17, role_name: "Recruiter",
  }), { statusCode: 403 });
});
