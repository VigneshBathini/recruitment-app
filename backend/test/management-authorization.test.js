import test from "node:test";
import assert from "node:assert/strict";
import pool from "../src/config/database.js";
import {
  authorizeOrganizationAdmin,
  authorizeUserManagement,
  preventOwnRolePermissionChange,
} from "../src/middleware/authorizeOrganizationAdmin.middleware.js";
import { replaceRolePermissions } from "../src/repositories/permission.repository.js";

function runMiddleware(middleware, req) {
  let nextCalled = false;
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  middleware(req, response, () => { nextCalled = true; });
  return { response, nextCalled };
}

test("only organization admins pass management authorization", () => {
  for (const role_name of ["Recruiter", "Hiring Manager", "Interviewer"]) {
    const { response, nextCalled } = runMiddleware(authorizeOrganizationAdmin, {
      user: { account_type: "organization_user", role_name },
    });
    assert.equal(response.statusCode, 403, `${role_name} should be denied`);
    assert.equal(nextCalled, false);
  }

  const platform = runMiddleware(authorizeOrganizationAdmin, {
    user: { account_type: "platform_admin", role_name: "Platform Admin" },
  });
  assert.equal(platform.response.statusCode, 403);
  assert.equal(platform.nextCalled, false);

  const platformUserManagement = runMiddleware(authorizeUserManagement, {
    user: { account_type: "platform_admin", role_name: "Platform Admin" },
  });
  assert.equal(platformUserManagement.nextCalled, true);

  const admin = runMiddleware(authorizeOrganizationAdmin, {
    user: { account_type: "organization_user", role_name: "Organization Admin" },
  });
  assert.equal(admin.response.statusCode, 200);
  assert.equal(admin.nextCalled, true);
});

test("organization admin cannot change permissions for their own role", () => {
  const result = runMiddleware(preventOwnRolePermissionChange, {
    params: { roleId: "7" },
    user: { role_id: 7 },
  });
  assert.equal(result.response.statusCode, 403);
  assert.equal(result.nextCalled, false);

  const otherRole = runMiddleware(preventOwnRolePermissionChange, {
    params: { roleId: "8" },
    user: { role_id: 7 },
  });
  assert.equal(otherRole.nextCalled, true);
});

test("role permission replacement validates tenant role membership before writes", async (t) => {
  const statements = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      statements.push(sql);
      if (/SELECT id FROM organizations/.test(sql)) return [[{ id: 1 }], []];
      if (/FROM organization_roles available/.test(sql)) return [[], []];
      return [[], []];
    },
  };
  t.mock.method(pool, "getConnection", async () => connection);

  await assert.rejects(
    replaceRolePermissions(1, 99, [1]),
    { statusCode: 404, message: "Role is not configured for this organization" },
  );
  assert.equal(statements.some((sql) => /DELETE FROM organization_role_permissions/.test(sql)), false);
});

test("organization admin role permissions are immutable through this endpoint", async (t) => {
  const statements = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      statements.push(sql);
      if (/SELECT id FROM organizations/.test(sql)) return [[{ id: 1 }], []];
      if (/FROM organization_roles available/.test(sql)) return [[{ id: 7, name: "Organization Admin" }], []];
      return [[], []];
    },
  };
  t.mock.method(pool, "getConnection", async () => connection);

  await assert.rejects(
    replaceRolePermissions(1, 7, [1]),
    { statusCode: 403, message: "Organization Admin role permissions cannot be modified" },
  );
  assert.equal(statements.some((sql) => /DELETE FROM organization_role_permissions/.test(sql)), false);
});

test("permission IDs unavailable to the organization are rejected before role changes", async (t) => {
  const statements = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      statements.push(sql);
      if (/SELECT id FROM organizations/.test(sql)) return [[{ id: 1 }], []];
      if (/FROM organization_roles available/.test(sql)) return [[{ id: 8, name: "Recruiter" }], []];
      if (/FROM organization_permissions/.test(sql)) return [[], []];
      return [[], []];
    },
  };
  t.mock.method(pool, "getConnection", async () => connection);

  await assert.rejects(
    replaceRolePermissions(1, 8, [500]),
    { statusCode: 400, message: "One or more permissions are invalid or unavailable to this organization" },
  );
  assert.equal(statements.some((sql) => /DELETE FROM organization_role_permissions/.test(sql)), false);
});
