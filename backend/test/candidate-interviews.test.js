import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import pool from "../src/config/database.js";
import candidateRoutes from "../src/routes/candidate.routes.js";

test("candidate interview endpoint authenticates, isolates by candidate and organization, and returns safe interview data", async (t) => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "candidate-interview-test-secret";
  t.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });

  const calls = [];
  const interviews = [
    { id: 42, application_id: 7, job_title: "Designer", interview_type: "TECHNICAL", scheduled_at: "2026-12-01T10:00:00.000Z", duration_minutes: 45, meeting_url: "https://meet.example/42", location: null, status: "SCHEDULED", created_by: 900, title: "Internal panel" },
    { id: 43, application_id: 7, job_title: "Designer", interview_type: "HR", scheduled_at: "2026-12-02T10:00:00.000Z", duration_minutes: 30, meeting_url: null, location: null, status: "CANCELLED" },
  ];
  t.mock.method(pool, "execute", async (sql, values) => {
    calls.push({ sql, values });
    if (/FROM candidates c/.test(sql)) return [[{ id: 15, organization_id: 3, first_name: "A", last_name: "Candidate", email: "a@example.test", is_active: 1, organization_is_active: 1 }], []];
    if (/FROM interviews i/.test(sql)) return [interviews, []];
    if (/FROM interview_panel_members/.test(sql)) return [[{ interview_id: 42, first_name: "Interviewer", last_name: "One" }], []];
    assert.fail(`Unexpected SQL: ${sql}`);
  });

  const app = express();
  app.use("/api/candidates", candidateRoutes);
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}/api/candidates/me/interviews`;

  const unauthorized = await fetch(base);
  assert.equal(unauthorized.status, 401);
  assert.equal(calls.length, 0);

  const token = jwt.sign({ sub: "15", organization_id: 3, account_type: "candidate" }, process.env.JWT_SECRET);
  const response = await fetch(`${base}?candidate_id=99&organization_id=88`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.length, 2);
  assert.equal(payload.data[0].status, "SCHEDULED");
  assert.equal(payload.data[0].scheduled_at, interviews[0].scheduled_at);
  assert.deepEqual(payload.data[0].interviewers, [{ name: "Interviewer One" }]);
  assert.equal(payload.data[1].status, "CANCELLED");
  assert.equal("created_by" in payload.data[0], false);
  assert.equal("title" in payload.data[0], false);

  const candidateQuery = calls.find(({ sql }) => /FROM interviews i/.test(sql));
  assert.match(candidateQuery.sql, /a\.candidate_id = \? AND a\.organization_id = \?/);
  assert.deepEqual(candidateQuery.values, [15, 3]);
  const panelQuery = calls.find(({ sql }) => /FROM interview_panel_members/.test(sql));
  assert.match(panelQuery.sql, /u\.organization_id = \?/);
  assert.match(panelQuery.sql, /a\.candidate_id = \?/);
  assert.deepEqual(panelQuery.values, [3, 3, 42, 43, 15]);
});
