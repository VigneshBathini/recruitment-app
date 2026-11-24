import test from "node:test";
import assert from "node:assert/strict";
import pool from "../src/config/database.js";
import {
  decideApprovalRequestService,
  getApprovalRequestService,
  getApprovalWorkflowsService,
  submitApprovalRequestService,
} from "../src/services/approval.service.js";
import { decideApprovalRequest, getApprovalRequest } from "../src/repositories/approval.repository.js";

const actor = { id: 20, organization_id: 3, role_id: 8 };

test("JOB_REQUIREMENT approval submission and decisions require their mapped permissions", async (t) => {
  const queries = [];
  t.mock.method(pool, "execute", async (sql, values) => {
    queries.push({ sql, values });
    if (/FROM permissions p/.test(sql)) return [[], []];
    if (/FROM approval_requests ar/.test(sql)) {
      return [[{ id: 5, organization_id: 3, entity_type: "JOB_REQUIREMENT" }], []];
    }
    return [[], []];
  });
  t.mock.method(pool, "getConnection", async () => assert.fail("Permission denial must happen before a decision transaction"));

  await assert.rejects(
    submitApprovalRequestService({ workflow_id: 2, entity_type: "JOB_REQUIREMENT", entity_id: 4 }, actor),
    { statusCode: 403 },
  );
  await assert.rejects(getApprovalWorkflowsService("JOB_REQUIREMENT", actor), { statusCode: 403 });
  await assert.rejects(getApprovalRequestService(5, actor), { statusCode: 403 });
  await assert.rejects(decideApprovalRequestService(5, { step_order: 1 }, actor, "APPROVED"), { statusCode: 403 });
  assert.equal(queries.filter(({ sql }) => /FROM permissions p/.test(sql)).length, 4);
});

test("unmapped approval entity types fail closed before permission or repository work", async (t) => {
  t.mock.method(pool, "execute", async () => assert.fail("Unmapped types must fail before database access"));
  await assert.rejects(
    getApprovalWorkflowsService("NOT_A_REAL_ENTITY", actor),
    { statusCode: 400, message: "Unsupported approval entity type: NOT_A_REAL_ENTITY" },
  );
  await assert.rejects(
    submitApprovalRequestService({ workflow_id: 2, entity_type: "unknown", entity_id: 4 }, actor),
    { statusCode: 400, message: "Unsupported approval entity type: UNKNOWN" },
  );
});

test("JOB and OFFER approval workflow permissions remain mapped", async (t) => {
  const checked = [];
  t.mock.method(pool, "execute", async (sql, values) => {
    if (/FROM permissions p/.test(sql)) {
      const name = checked.length === 0 ? "job.manage" : "offer.manage";
      checked.push(name);
      return [[{ name }], []];
    }
    if (/FROM approval_workflows/.test(sql)) return [[], []];
    return [[], []];
  });
  assert.deepEqual(await getApprovalWorkflowsService("JOB", actor), []);
  assert.deepEqual(await getApprovalWorkflowsService("OFFER", actor), []);
  assert.deepEqual(checked, ["job.manage", "offer.manage"]);
});

test("JOB_REQUIREMENT approval permission can access its workflow and act as reviewer", async (t) => {
  let permissionChecks = 0;
  t.mock.method(pool, "execute", async (sql) => {
    if (/FROM permissions p/.test(sql)) {
      permissionChecks += 1;
      return [[{ name: "requirement.approve" }], []];
    }
    if (/FROM approval_workflows/.test(sql)) return [[], []];
    return [[], []];
  });
  assert.deepEqual(await getApprovalWorkflowsService("job_requirement", actor), []);
  assert.equal(permissionChecks, 1);
});

function transactionMock(t, request, entityExists = true) {
  const statements = [];
  const tx = { rolledBack: false, committed: false };
  t.mock.method(pool, "getConnection", async () => ({
    beginTransaction: async () => undefined,
    commit: async () => { tx.committed = true; },
    rollback: async () => { tx.rolledBack = true; },
    release: () => undefined,
    execute: async (sql, values) => {
      statements.push({ sql, values });
      if (/FROM approval_requests\s+WHERE id = \? AND organization_id = \? FOR UPDATE/.test(sql)) return [request ? [request] : [], []];
      if (/FROM jobs/.test(sql)) return [entityExists ? [{ id: request.entity_id }] : [], []];
      return [[], []];
    },
  }));
  return { statements, tx };
}

test("approval repository denies cross-organization reads and entity ownership", async (t) => {
  const readQueries = [];
  t.mock.method(pool, "execute", async (sql, values) => {
    readQueries.push({ sql, values });
    return [[], []];
  });
  assert.equal(await getApprovalRequest(9, 55), null);
  assert.match(readQueries[0].sql, /ar\.id = \? AND ar\.organization_id = \?/);
  assert.deepEqual(readQueries[0].values, [9, 55]);

  t.mock.restoreAll();
  const request = { id: 9, entity_type: "JOB", entity_id: 12, organization_id: 3, status: "PENDING", requested_by: 7, current_step: 1 };
  const { statements, tx } = transactionMock(t, request, false);
  await assert.rejects(decideApprovalRequest({ requestId: 9, organizationId: 3, userId: 20, roleId: 8, stepOrder: 1, decision: "APPROVED" }), { statusCode: 404 });
  assert.equal(tx.rolledBack, true);
  assert.equal(statements.some(({ sql }) => /INSERT INTO approval_actions/.test(sql)), false);
});

test("approval decisions still reject self-approval and stale step submissions", async (t) => {
  const selfRequest = { id: 9, entity_type: "JOB", entity_id: 12, organization_id: 3, status: "PENDING", requested_by: 20, current_step: 1 };
  const self = transactionMock(t, selfRequest);
  await assert.rejects(decideApprovalRequest({ requestId: 9, organizationId: 3, userId: 20, roleId: 8, stepOrder: 1, decision: "APPROVED" }), { statusCode: 403 });
  assert.equal(self.tx.rolledBack, true);

  t.mock.restoreAll();
  const staleRequest = { ...selfRequest, requested_by: 7, current_step: 2 };
  const stale = transactionMock(t, staleRequest);
  await assert.rejects(decideApprovalRequest({ requestId: 9, organizationId: 3, userId: 20, roleId: 8, stepOrder: 1, decision: "APPROVED" }), { statusCode: 409 });
  assert.equal(stale.tx.rolledBack, true);
  assert.equal(stale.statements.some(({ sql }) => /INSERT INTO approval_actions/.test(sql)), false);
});
