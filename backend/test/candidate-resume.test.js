import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import pool from "../src/config/database.js";
import candidateRoutes from "../src/routes/candidate.routes.js";
import { createCandidateApplication } from "../src/repositories/candidate.repository.js";
import { getApplicationResumeFileService } from "../src/services/application.service.js";
import { removeCandidateResume } from "../src/services/candidate-resume-storage.js";

test("candidate resumes upload privately, snapshot on application, survive replacement, and stay organization scoped", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "candidate-resume-test-secret";
  t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });

  const currentResumeByCandidate = new Map([[15, null], [18, null]]);
  const applicationResumeById = new Map();
  const storedKeys = new Set();
  t.after(async () => { for (const key of storedKeys) await removeCandidateResume(key); });
  const applications = [];
  t.mock.method(pool, "execute", async (sql, values = []) => {
    if (/FROM candidates c/.test(sql)) {
      const id = Number(values[0]);
      return [[{ id, organization_id: id === 18 ? 4 : 3, first_name: "Test", last_name: "Candidate", email: "test@example.test", is_active: 1, organization_is_active: 1 }], []];
    }
    if (/UPDATE candidates SET resume_url/.test(sql)) {
      currentResumeByCandidate.set(Number(values[1]), values[0]); storedKeys.add(values[0]);
      return [{ affectedRows: 1 }, []];
    }
    if (/FROM candidates WHERE id = \? AND organization_id = \?/.test(sql)) {
      const id = Number(values[0]);
      if (![15, 18].includes(id)) return [[], []];
      return [[{ id, first_name: "Test", last_name: "Candidate", email: "test@example.test", phone: null, resume_url: currentResumeByCandidate.get(id), created_at: "2026-01-01", updated_at: "2026-01-01" }], []];
    }
    if (/SELECT a\.resume_url, a\.id/.test(sql)) {
      const [id, organizationId] = values.map(Number);
      const entry = applicationResumeById.get(id);
      return [entry?.organizationId === organizationId ? [{ id, resume_url: entry.resumeKey }] : [], []];
    }
    assert.fail(`Unexpected SQL: ${sql}`);
  });

  let nextApplicationId = 40;
  t.mock.method(pool, "getConnection", async () => ({
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    execute: async (sql, values = []) => {
      if (/SELECT id, resume_url FROM candidates/.test(sql)) return [[{ id: Number(values[0]), resume_url: currentResumeByCandidate.get(Number(values[0])) }], []];
      if (/SELECT id FROM jobs/.test(sql)) return [[{ id: Number(values[0]) }], []];
      if (/INSERT INTO applications/.test(sql)) {
        const id = nextApplicationId++;
        const resumeKey = values.at(-1);
        applications.push({ id, resumeKey }); applicationResumeById.set(id, { organizationId: Number(values[0]), resumeKey });
        return [{ insertId: id }, []];
      }
      if (/INSERT INTO application_status_history/.test(sql)) return [{ affectedRows: 1 }, []];
      assert.fail(`Unexpected transaction SQL: ${sql}`);
    },
  }));

  const app = express(); app.use("/api/candidates", candidateRoutes);
  const server = app.listen(0); t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/candidates/me`;
  const tokenFor = (id, organizationId) => jwt.sign({ sub: String(id), organization_id: organizationId, account_type: "candidate" }, process.env.JWT_SECRET);
  const candidateHeaders = (id, organizationId) => ({ Authorization: `Bearer ${tokenFor(id, organizationId)}` });

  assert.equal((await fetch(`${base}/resume`, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: Buffer.from("%PDF-1.7 test") })).status, 401);
  const upload = async (id, organizationId, contents) => fetch(`${base}/resume?file_name=profile.pdf`, { method: "POST", headers: { ...candidateHeaders(id, organizationId), "Content-Type": "application/pdf" }, body: Buffer.from(`%PDF-1.7 ${contents}`) });
  assert.equal((await upload(15, 3, "first")).status, 200);
  const firstApplication = await createCandidateApplication(15, 3, 99);
  assert.equal(firstApplication.id, 40);
  const firstResumeKey = applications[0].resumeKey;
  assert.ok(firstResumeKey);

  assert.equal((await upload(15, 3, "replacement")).status, 200);
  const secondApplication = await createCandidateApplication(15, 3, 99);
  assert.equal(secondApplication.id, 41);
  assert.notEqual(applications[1].resumeKey, firstResumeKey);
  assert.equal(applications[0].resumeKey, firstResumeKey);

  const candidateFile = await fetch(`${base}/resume/file`, { headers: candidateHeaders(15, 3) });
  assert.equal(candidateFile.status, 200);
  assert.match(candidateFile.headers.get("content-type"), /application\/pdf/);
  const otherCandidateFile = await fetch(`${base}/resume/file?candidate_id=15`, { headers: candidateHeaders(18, 4) });
  assert.equal(otherCandidateFile.status, 404);

  const applicationFile = await getApplicationResumeFileService(40, 3);
  assert.equal(applicationFile.path.endsWith(firstResumeKey), true);
  await assert.rejects(getApplicationResumeFileService(40, 4), { statusCode: 404 });
});
