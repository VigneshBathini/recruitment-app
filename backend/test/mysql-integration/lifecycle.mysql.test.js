import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import pool from "../../src/config/database.js";
import { registerCandidate, loginCandidate } from "../../src/services/candidate.service.js";
import {
  submitApprovalRequestService,
  decideApprovalRequestService,
} from "../../src/services/approval.service.js";
import {
  createOfferService,
  issueOfferService,
  submitOfferService,
} from "../../src/services/offer.service.js";
import { respondToMyOfferService } from "../../src/services/candidate-offer.service.js";
import {
  completeOnboardingService,
  createOnboardingService,
  createOnboardingTaskService,
  updateCandidateTaskService,
  updateOnboardingService,
} from "../../src/services/onboarding.service.js";
import {
  moveApplicationToStageService,
  withdrawCandidateApplicationService,
  withdrawManagedApplicationService,
} from "../../src/services/application.service.js";
import onboardingRoutes from "../../src/routes/onboarding.routes.js";
import applicationRoutes from "../../src/routes/application.routes.js";
import candidateRoutes from "../../src/routes/candidate.routes.js";

const roles = ["Recruiter", "Hiring Manager", "Interviewer"];
const permissionNames = [
  "job.manage", "job.approve", "offer.manage", "offer.approve", "offer.issue",
  "onboarding.manage", "onboarding.complete", "onboarding.document.review", "onboarding.view", "application.manage",
];
const defaultTerms = {
  annual_ctc: 1200000,
  currency: "INR",
  employment_type: "FULL_TIME",
  work_location: "Bengaluru",
  start_date: "2030-01-15",
  expiry_date: "2030-02-01",
  offer_letter_url: null,
};

async function insert(sql, values = []) {
  const [result] = await pool.execute(sql, values);
  return result.insertId;
}

async function rows(sql, values = []) {
  const [result] = await pool.execute(sql, values);
  return result;
}

async function setupOrganization(name) {
  const organizationId = await insert("INSERT INTO organizations (name, slug) VALUES (?, ?)", [name, `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`]);
  const roleIds = {};
  for (const role of roles) roleIds[role] = await insert("INSERT INTO roles (name) VALUES (?)", [`${name} ${role}`]);
  const permissionIds = {};
  for (const permission of permissionNames) {
    const [result] = await pool.execute(
      "INSERT INTO permissions (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)",
      [permission],
    );
    permissionIds[permission] = result.insertId;
  }
  for (const [role, permissions] of [
    ["Recruiter", ["job.manage", "offer.manage", "offer.issue", "onboarding.manage", "onboarding.view", "application.manage"]],
    ["Hiring Manager", ["job.approve", "offer.approve", "onboarding.complete", "onboarding.view", "onboarding.document.review"]],
    ["Interviewer", []],
  ]) {
    for (const permission of permissions) {
      await pool.execute(
        `INSERT INTO organization_role_permissions (organization_id, role_id, permission_id)
         VALUES (?, ?, ?)`,
        [organizationId, roleIds[role], permissionIds[permission]],
      );
    }
  }
  const userIds = {};
  for (const role of roles) {
    userIds[role] = await insert(
      `INSERT INTO users (organization_id, role_id, first_name, last_name, email, password_hash)
       VALUES (?, ?, ?, ?, ?, 'unused-hash')`,
      [organizationId, roleIds[role], role, name, `${role.toLowerCase().replaceAll(" ", ".")}@${name.toLowerCase()}.test`],
    );
  }
  return { organizationId, roleIds, userIds };
}

async function createSelectedApplication(organizationId, recruiterId, label) {
  const candidateId = await insert(
    `INSERT INTO candidates (organization_id, first_name, last_name, email, password_hash)
     VALUES (?, ?, 'Applicant', ?, 'unused-hash')`,
    [organizationId, label, `${label.toLowerCase()}@candidate.test`],
  );
  const requirementId = await insert(
    `INSERT INTO job_requirements (organization_id, created_by, title, status)
     VALUES (?, ?, ?, 'APPROVED')`, [organizationId, recruiterId, `${label} Requirement`],
  );
  const jobId = await insert(
    `INSERT INTO jobs (requirement_id, title, jd_content, status, organization_id)
     VALUES (?, ?, 'Lifecycle integration role', 'PUBLISHED', ?)`, [requirementId, `${label} Engineer`, organizationId],
  );
  const applicationId = await insert(
    `INSERT INTO applications (candidate_id, organization_id, job_id, status, current_stage, decision)
     VALUES (?, ?, ?, 'SHORTLISTED', 'SHORTLISTED', 'SELECTED')`,
    [candidateId, organizationId, jobId],
  );
  return { candidateId, requirementId, jobId, applicationId };
}

async function createWorkflow(organizationId, entityType, roleId, steps = 1) {
  const workflowId = await insert(
    `INSERT INTO approval_workflows (organization_id, name, entity_type, is_active)
     VALUES (?, ?, ?, 1)`, [organizationId, `${entityType} integration workflow`, entityType],
  );
  for (let order = 1; order <= steps; order++) {
    await insert(
      `INSERT INTO approval_workflow_steps (approval_workflow_id, step_order, approver_role_id, name)
       VALUES (?, ?, ?, ?)`, [workflowId, order, roleId, `Step ${order}`],
    );
  }
  return workflowId;
}

function managementUser(id, organizationId, roleId) {
  return { id, organization_id: organizationId, role_id: roleId };
}

test("real MySQL candidate, approval, offer, onboarding and HIRED lifecycle remains isolated and transactional", {
  skip: process.env.RECRUITMENT_TEST_DATABASE !== "1",
}, async (t) => {
  assert.equal(process.env.RECRUITMENT_TEST_DATABASE, "1", "run through the isolated MySQL test runner only");
  assert.match(process.env.DB_NAME || "", /^recruitment_workflow_test_/);
  t.after(() => pool.end());
  const alpha = await setupOrganization("Lifecycle Alpha");
  const beta = await setupOrganization("Lifecycle Beta");
  const recruiter = managementUser(alpha.userIds.Recruiter, alpha.organizationId, alpha.roleIds.Recruiter);
  const manager = managementUser(alpha.userIds["Hiring Manager"], alpha.organizationId, alpha.roleIds["Hiring Manager"]);
  const betaManager = managementUser(beta.userIds["Hiring Manager"], beta.organizationId, beta.roleIds["Hiring Manager"]);

  await t.test("candidate registration/login handles invalid and inactive accounts and scopes identity by organization", async () => {
    const slugA = (await rows("SELECT slug FROM organizations WHERE id = ?", [alpha.organizationId]))[0].slug;
    const slugB = (await rows("SELECT slug FROM organizations WHERE id = ?", [beta.organizationId]))[0].slug;
    const email = "same-person@example.test";
    const registeredA = await registerCandidate({ organization_slug: slugA, first_name: "Candidate", last_name: "Alpha", email, password: "passphrase-a1" });
    const registeredB = await registerCandidate({ organization_slug: slugB, first_name: "Candidate", last_name: "Beta", email, password: "passphrase-b1" });
    assert.notEqual(registeredA.candidate.id, registeredB.candidate.id);
    assert.equal((await loginCandidate({ organization_slug: slugA, email, password: "passphrase-a1" })).candidate.id, registeredA.candidate.id);
    await assert.rejects(loginCandidate({ organization_slug: slugA, email, password: "incorrect-password" }), { statusCode: 401 });
    await assert.rejects(loginCandidate({ organization_slug: slugB, email, password: "passphrase-a1" }), { statusCode: 401 });
    await pool.execute("UPDATE candidates SET is_active = 0 WHERE id = ? AND organization_id = ?", [registeredB.candidate.id, beta.organizationId]);
    await assert.rejects(loginCandidate({ organization_slug: slugB, email, password: "passphrase-b1" }), { statusCode: 401 });
  });

  await t.test("candidate can withdraw only their own pre-acceptance application with a required reason", async (context) => {
    const ownerId = await insert(
      `INSERT INTO candidates (organization_id, first_name, email, password_hash) VALUES (?, 'Owner', 'withdraw-owner@example.test', 'unused')`,
      [alpha.organizationId],
    );
    const sameOrgOtherId = await insert(
      `INSERT INTO candidates (organization_id, first_name, email, password_hash) VALUES (?, 'Other', 'withdraw-other@example.test', 'unused')`,
      [alpha.organizationId],
    );
    const { requirementId, jobId } = await createSelectedApplication(alpha.organizationId, recruiter.id, "Self withdrawal");
    const applicationId = await insert(
      `INSERT INTO applications (candidate_id, organization_id, job_id, status, current_stage, decision)
       VALUES (?, ?, ?, 'SCREENING', 'PHONE_SCREEN', NULL)`, [ownerId, alpha.organizationId, jobId],
    );
    const offerId = await insert(
      `INSERT INTO offers (organization_id, application_id, annual_ctc, employment_type, start_date, created_by, status)
       VALUES (?, ?, 1000000, 'FULL_TIME', '2030-01-15', ?, 'DRAFT')`, [alpha.organizationId, applicationId, recruiter.id],
    );
    const interviewId = await insert(
      `INSERT INTO interviews (application_id, interview_type, title, scheduled_at, duration_minutes, created_by)
       VALUES (?, 'TECHNICAL', 'Preserved interview', '2030-01-01 10:00:00', 30, ?)`, [applicationId, recruiter.id],
    );
    const betaCandidateId = await insert(
      `INSERT INTO candidates (organization_id, first_name, email, password_hash) VALUES (?, 'Foreign', 'withdraw-foreign@example.test', 'unused')`,
      [beta.organizationId],
    );
    const ownerToken = jwt.sign({ sub: String(ownerId), organization_id: alpha.organizationId, account_type: "candidate" }, process.env.JWT_SECRET);
    const otherToken = jwt.sign({ sub: String(sameOrgOtherId), organization_id: alpha.organizationId, account_type: "candidate" }, process.env.JWT_SECRET);
    const betaCandidateToken = jwt.sign({ sub: String(betaCandidateId), organization_id: beta.organizationId, account_type: "candidate" }, process.env.JWT_SECRET);
    const candidateApp = express();
    candidateApp.use(express.json());
    candidateApp.use("/api/candidates", candidateRoutes);
    const server = candidateApp.listen(0, "127.0.0.1");
    await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
    context.after(() => new Promise((resolve) => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/api/candidates/me/applications/${applicationId}/withdraw`;
    const withdraw = (token, reason) => fetch(url, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(reason === undefined ? {} : { reason }),
    });
    assert.equal((await withdraw(ownerToken)).status, 400);
    assert.equal((await withdraw(ownerToken, "   ")).status, 400);
    assert.equal((await withdraw(otherToken, "No longer interested")).status, 404);
    assert.equal((await withdraw(betaCandidateToken, "No longer interested")).status, 404);
    const response = await withdraw(ownerToken, "Accepted another opportunity");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, "WITHDRAWN");
    const history = (await rows("SELECT * FROM application_status_history WHERE application_id = ? AND to_status = 'WITHDRAWN'", [applicationId]))[0];
    assert.equal(history.from_status, "SCREENING");
    assert.equal(history.changed_by, null);
    assert.equal(history.actor_type, "CANDIDATE");
    assert.equal(Number(history.actor_id), ownerId);
    assert.equal(history.reason, "Accepted another opportunity");
    assert.equal((await rows("SELECT status FROM offers WHERE id = ?", [offerId]))[0].status, "DRAFT");
    assert.equal((await rows("SELECT COUNT(*) AS n FROM interviews WHERE id = ?", [interviewId]))[0].n, 1);
    await assert.rejects(moveApplicationToStageService(applicationId, { stage: "SCREENING" }, recruiter), { statusCode: 409 });
    await assert.rejects(withdrawCandidateApplicationService(applicationId, { reason: "Again" }, { id: ownerId, organization_id: alpha.organizationId }), { statusCode: 409 });
    assert.ok(requirementId);
  });

  await t.test("generic approval validates tenant, configured step, stale steps, approval and rejection", async () => {
    const workflowId = await createWorkflow(alpha.organizationId, "JOB", alpha.roleIds["Hiring Manager"], 2);
    const requirementId = await insert(
      `INSERT INTO job_requirements (organization_id, created_by, title, status) VALUES (?, ?, 'Approval job', 'APPROVED')`,
      [alpha.organizationId, recruiter.id],
    );
    const jobId = await insert(
      `INSERT INTO jobs (requirement_id, organization_id, title, jd_content, status) VALUES (?, ?, 'Approval job', 'content', 'DRAFT')`,
      [requirementId, alpha.organizationId],
    );
    const submitted = await submitApprovalRequestService({ workflow_id: workflowId, entity_type: "JOB", entity_id: jobId }, recruiter);
    assert.equal(submitted.status, "PENDING");
    assert.equal((await rows("SELECT status FROM jobs WHERE id = ?", [jobId]))[0].status, "PENDING_APPROVAL");
    await assert.rejects(decideApprovalRequestService(submitted.id, { step_order: 1 }, betaManager, "APPROVED"), { statusCode: 404 });
    await assert.rejects(decideApprovalRequestService(submitted.id, { step_order: 2 }, manager, "APPROVED"), { statusCode: 409 });
    await decideApprovalRequestService(submitted.id, { step_order: 1 }, manager, "APPROVED");
    await assert.rejects(decideApprovalRequestService(submitted.id, { step_order: 1 }, manager, "APPROVED"), { statusCode: 409 });
    const approved = await decideApprovalRequestService(submitted.id, { step_order: 2 }, manager, "APPROVED");
    assert.equal(approved.status, "APPROVED");
    assert.equal((await rows("SELECT status FROM jobs WHERE id = ?", [jobId]))[0].status, "APPROVED");

    const rejectRequirement = await insert(
      `INSERT INTO job_requirements (organization_id, created_by, title, status) VALUES (?, ?, 'Rejected job', 'APPROVED')`,
      [alpha.organizationId, recruiter.id],
    );
    const rejectJob = await insert(
      `INSERT INTO jobs (requirement_id, organization_id, title, jd_content, status) VALUES (?, ?, 'Rejected job', 'content', 'DRAFT')`,
      [rejectRequirement, alpha.organizationId],
    );
    const rejectedRequest = await submitApprovalRequestService({ workflow_id: workflowId, entity_type: "JOB", entity_id: rejectJob }, recruiter);
    const rejected = await decideApprovalRequestService(rejectedRequest.id, { step_order: 1, comments: "Needs revision" }, manager, "REJECTED");
    assert.equal(rejected.status, "REJECTED");
    assert.equal((await rows("SELECT status FROM jobs WHERE id = ?", [rejectJob]))[0].status, "REJECTED");
    assert.equal((await rows("SELECT comments FROM approval_actions WHERE approval_request_id = ?", [rejectedRequest.id]))[0].comments, "Needs revision");
  });

  const offerWorkflowId = await createWorkflow(alpha.organizationId, "OFFER", alpha.roleIds["Hiring Manager"]);
  const firstApp = await createSelectedApplication(alpha.organizationId, recruiter.id, "First Candidate");
  const offer1 = await createOfferService({ application_id: firstApp.applicationId, ...defaultTerms }, recruiter);
  await assert.rejects(createOnboardingService({ offer_id: offer1.id }, recruiter), { statusCode: 409 });
  const submittedOffer = await submitOfferService(offer1.id, { workflow_id: offerWorkflowId }, recruiter);
  const approval = await decideApprovalRequestService(submittedOffer.approval_request.id, { step_order: 1 }, manager, "APPROVED");
  assert.equal(approval.status, "APPROVED");
  await issueOfferService(offer1.id, recruiter);
  const candidate = { id: firstApp.candidateId, organization_id: alpha.organizationId };
  const foreignCandidateId = await insert(
    `INSERT INTO candidates (organization_id, first_name, email, password_hash)
     VALUES (?, 'Foreign', 'foreign-offer-candidate@example.test', 'unused-hash')`, [beta.organizationId],
  );
  await assert.rejects(respondToMyOfferService(offer1.id, { id: foreignCandidateId, organization_id: beta.organizationId }, "ACCEPTED"), { statusCode: 404 });
  const accepted = await respondToMyOfferService(offer1.id, candidate, "ACCEPTED", "Accepted for test");
  assert.equal(accepted.status, "ACCEPTED");

  const onboarding = await createOnboardingService({ offer_id: offer1.id }, recruiter);
  assert.equal(onboarding.status, "INITIATED");
  const task = await createOnboardingTaskService(onboarding.id, {
    title: "Upload identity document", assigned_to_candidate_id: candidate.id,
  }, recruiter);
  await updateCandidateTaskService(task.id, { status: "IN_PROGRESS" }, candidate);
  await updateCandidateTaskService(task.id, { status: "COMPLETED" }, candidate);
  await assert.rejects(updateCandidateTaskService(task.id, { status: "PENDING" }, candidate), { statusCode: 409 });

  const documentId = await insert(
    `INSERT INTO candidate_documents
     (organization_id, candidate_id, onboarding_id, document_type, file_name, file_url, mime_type, file_size)
     VALUES (?, ?, ?, 'IDENTITY', 'identity.pdf', 'integration-only-key', 'application/pdf', 12)`,
    [alpha.organizationId, candidate.id, onboarding.id],
  );
  const unauthorizedToken = jwt.sign({ sub: String(recruiter.id), organization_id: alpha.organizationId, account_type: "organization_user" }, process.env.JWT_SECRET);
  const managerToken = jwt.sign({ sub: String(manager.id), organization_id: alpha.organizationId, account_type: "organization_user" }, process.env.JWT_SECRET);
  const betaToken = jwt.sign({ sub: String(betaManager.id), organization_id: beta.organizationId, account_type: "organization_user" }, process.env.JWT_SECRET);
  const app = express();
  app.use(express.json());
  app.use("/api/onboarding", onboardingRoutes);
  app.use("/api/applications", applicationRoutes);
  app.use("/api/candidates", candidateRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/onboarding/documents/${documentId}/review`;
  const postReview = (token) => fetch(base, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ review_status: "VERIFIED" }) });
  assert.equal((await postReview(unauthorizedToken)).status, 403);
  assert.equal((await postReview(betaToken)).status, 404);
  assert.equal((await postReview(managerToken)).status, 200);
  assert.equal((await rows("SELECT review_status FROM candidate_documents WHERE id = ?", [documentId]))[0].review_status, "VERIFIED");

  const withdrawalApp = await createSelectedApplication(alpha.organizationId, recruiter.id, "Managed withdrawal");
  const withdrawalOfferId = await insert(
    `INSERT INTO offers (organization_id, application_id, annual_ctc, employment_type, start_date, created_by, status, issued_at, candidate_responded_at)
     VALUES (?, ?, 1500000, 'FULL_TIME', '2030-01-15', ?, 'ACCEPTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [alpha.organizationId, withdrawalApp.applicationId, recruiter.id],
  );
  const withdrawalOnboardingId = await insert(
    `INSERT INTO onboarding_records (organization_id, offer_id, application_id, candidate_id, status, initiated_by)
     VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?)`,
    [alpha.organizationId, withdrawalOfferId, withdrawalApp.applicationId, withdrawalApp.candidateId, recruiter.id],
  );
  const withdrawalTaskId = await insert(
    `INSERT INTO onboarding_tasks (organization_id, onboarding_id, title, assigned_to_candidate_id, status)
     VALUES (?, ?, 'Return signed documents', ?, 'PENDING')`,
    [alpha.organizationId, withdrawalOnboardingId, withdrawalApp.candidateId],
  );
  const withdrawalDocumentId = await insert(
    `INSERT INTO candidate_documents (organization_id, candidate_id, onboarding_id, document_type, file_name, file_url)
     VALUES (?, ?, ?, 'IDENTITY', 'withdrawal-id.pdf', 'preserved-withdrawal-file')`,
    [alpha.organizationId, withdrawalApp.candidateId, withdrawalOnboardingId],
  );
  const withdrawalInterviewId = await insert(
    `INSERT INTO interviews (application_id, interview_type, title, status, created_by)
     VALUES (?, 'HR', 'Preserved interview', 'COMPLETED', ?)`,
    [withdrawalApp.applicationId, recruiter.id],
  );
  const withdrawalCandidateToken = jwt.sign({ sub: String(withdrawalApp.candidateId), organization_id: alpha.organizationId, account_type: "candidate" }, process.env.JWT_SECRET);
  const acceptedAppList = await fetch(`http://127.0.0.1:${server.address().port}/api/candidates/me/applications`, {
    headers: { authorization: `Bearer ${withdrawalCandidateToken}` },
  });
  const acceptedAppData = await acceptedAppList.json();
  assert.equal(Number(acceptedAppData.data.find((application) => application.id === withdrawalApp.applicationId).has_accepted_offer), 1);
  const managementWithdrawalUrl = `http://127.0.0.1:${server.address().port}/api/applications/${withdrawalApp.applicationId}/withdraw`;
  const managementWithdraw = (token, reason) => fetch(managementWithdrawalUrl, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const candidateWithdrawalUrl = `http://127.0.0.1:${server.address().port}/api/candidates/me/applications/${withdrawalApp.applicationId}/withdraw`;
  await assert.rejects(
    withdrawCandidateApplicationService(withdrawalApp.applicationId, { reason: "Candidate asked to withdraw" }, { id: withdrawalApp.candidateId, organization_id: alpha.organizationId }),
    { statusCode: 409 },
  );
  assert.equal((await fetch(candidateWithdrawalUrl, {
    method: "POST", headers: { authorization: `Bearer ${withdrawalCandidateToken}`, "content-type": "application/json" },
    body: JSON.stringify({ reason: "Please withdraw me" }),
  })).status, 409);
  assert.equal((await managementWithdraw(managerToken, "Candidate withdrew after acceptance")).status, 403);
  await pool.query(`CREATE TRIGGER test_fail_withdraw_history BEFORE INSERT ON application_status_history
    FOR EACH ROW BEGIN IF NEW.to_status = 'WITHDRAWN' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test withdrawal history failure'; END IF; END`);
  try {
    await assert.rejects(withdrawManagedApplicationService(withdrawalApp.applicationId, { reason: "Candidate withdrew after acceptance" }, recruiter), /test withdrawal history failure/);
    assert.equal((await rows("SELECT status FROM applications WHERE id = ?", [withdrawalApp.applicationId]))[0].status, "SHORTLISTED");
    assert.equal((await rows("SELECT status FROM onboarding_records WHERE id = ?", [withdrawalOnboardingId]))[0].status, "IN_PROGRESS");
    assert.equal((await rows("SELECT status FROM onboarding_tasks WHERE id = ?", [withdrawalTaskId]))[0].status, "PENDING");
  } finally {
    await pool.query("DROP TRIGGER IF EXISTS test_fail_withdraw_history");
  }
  const managedResponse = await managementWithdraw(unauthorizedToken, "Candidate withdrew after acceptance");
  assert.equal(managedResponse.status, 200);
  assert.equal((await managedResponse.json()).data.status, "WITHDRAWN");
  const managedHistory = (await rows("SELECT * FROM application_status_history WHERE application_id = ? AND to_status = 'WITHDRAWN'", [withdrawalApp.applicationId]))[0];
  assert.equal(managedHistory.from_status, "SHORTLISTED");
  assert.equal(managedHistory.actor_type, "MANAGEMENT_USER");
  assert.equal(Number(managedHistory.actor_id), recruiter.id);
  assert.equal(managedHistory.reason, "Candidate withdrew after acceptance");
  assert.equal((await rows("SELECT status FROM offers WHERE id = ?", [withdrawalOfferId]))[0].status, "ACCEPTED");
  assert.equal((await rows("SELECT status FROM onboarding_records WHERE id = ?", [withdrawalOnboardingId]))[0].status, "CANCELLED");
  assert.equal((await rows("SELECT status FROM onboarding_tasks WHERE id = ?", [withdrawalTaskId]))[0].status, "CANCELLED");
  assert.equal((await rows("SELECT COUNT(*) AS n FROM candidate_documents WHERE id = ?", [withdrawalDocumentId]))[0].n, 1);
  assert.equal((await rows("SELECT COUNT(*) AS n FROM interviews WHERE id = ?", [withdrawalInterviewId]))[0].n, 1);
  assert.equal((await rows("SELECT COUNT(*) AS n FROM workflow_history WHERE entity_type = 'ONBOARDING' AND entity_id = ? AND new_value = 'CANCELLED'", [withdrawalOnboardingId]))[0].n, 1);
  assert.equal((await rows("SELECT COUNT(*) AS n FROM workflow_history WHERE entity_type = 'ONBOARDING_TASK' AND entity_id = ? AND new_value = 'CANCELLED'", [withdrawalTaskId]))[0].n, 1);
  await assert.rejects(moveApplicationToStageService(withdrawalApp.applicationId, { stage: "SCREENING" }, recruiter), { statusCode: 409 });

  const completedOnboardingApp = await createSelectedApplication(alpha.organizationId, recruiter.id, "Completed onboarding withdrawal");
  const completedOfferId = await insert(
    `INSERT INTO offers (organization_id, application_id, annual_ctc, employment_type, start_date, created_by, status, issued_at, candidate_responded_at)
     VALUES (?, ?, 1500000, 'FULL_TIME', '2030-01-15', ?, 'ACCEPTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [alpha.organizationId, completedOnboardingApp.applicationId, recruiter.id],
  );
  const completedOnboardingId = await insert(
    `INSERT INTO onboarding_records (organization_id, offer_id, application_id, candidate_id, status, initiated_by)
     VALUES (?, ?, ?, ?, 'COMPLETED', ?)`,
    [alpha.organizationId, completedOfferId, completedOnboardingApp.applicationId, completedOnboardingApp.candidateId, recruiter.id],
  );
  await withdrawManagedApplicationService(completedOnboardingApp.applicationId, { reason: "Candidate withdrew before joining" }, recruiter);
  assert.equal((await rows("SELECT status FROM applications WHERE id = ?", [completedOnboardingApp.applicationId]))[0].status, "WITHDRAWN");
  assert.equal((await rows("SELECT status FROM onboarding_records WHERE id = ?", [completedOnboardingId]))[0].status, "COMPLETED");
  assert.equal((await rows("SELECT status FROM offers WHERE id = ?", [completedOfferId]))[0].status, "ACCEPTED");

  await updateOnboardingService(onboarding.id, { status: "IN_PROGRESS" }, recruiter);
  await updateOnboardingService(onboarding.id, { status: "READY_TO_JOIN" }, recruiter);

  await t.test("final HIRED transaction rolls back when history insertion fails", async () => {
    await pool.query(`CREATE TRIGGER test_fail_hired_history BEFORE INSERT ON application_status_history
      FOR EACH ROW BEGIN IF NEW.to_status = 'HIRED' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test history failure'; END IF; END`);
    try {
      await assert.rejects(completeOnboardingService(onboarding.id, manager), /test history failure/);
      assert.equal((await rows("SELECT status FROM applications WHERE id = ?", [firstApp.applicationId]))[0].status, "SHORTLISTED");
      assert.equal((await rows("SELECT status FROM onboarding_records WHERE id = ?", [onboarding.id]))[0].status, "READY_TO_JOIN");
      assert.equal((await rows("SELECT COUNT(*) AS n FROM application_status_history WHERE application_id = ? AND to_status = 'HIRED'", [firstApp.applicationId]))[0].n, 0);
    } finally {
      await pool.query("DROP TRIGGER IF EXISTS test_fail_hired_history");
    }
  });

  await t.test("final HIRED transaction rolls back when onboarding status update fails", async () => {
    await pool.query(`CREATE TRIGGER test_fail_onboarding_completion BEFORE UPDATE ON onboarding_records
      FOR EACH ROW BEGIN IF NEW.status = 'COMPLETED' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test status failure'; END IF; END`);
    try {
      await assert.rejects(completeOnboardingService(onboarding.id, manager), /test status failure/);
      assert.equal((await rows("SELECT status FROM applications WHERE id = ?", [firstApp.applicationId]))[0].status, "SHORTLISTED");
      assert.equal((await rows("SELECT status FROM onboarding_records WHERE id = ?", [onboarding.id]))[0].status, "READY_TO_JOIN");
      assert.equal((await rows("SELECT COUNT(*) AS n FROM application_status_history WHERE application_id = ? AND to_status = 'HIRED'", [firstApp.applicationId]))[0].n, 0);
    } finally {
      await pool.query("DROP TRIGGER IF EXISTS test_fail_onboarding_completion");
    }
  });

  const hired = await completeOnboardingService(onboarding.id, manager);
  assert.equal(hired.onboarding.status, "COMPLETED");
  assert.equal((await rows("SELECT status, current_stage FROM applications WHERE id = ?", [firstApp.applicationId]))[0].status, "HIRED");
  assert.equal((await rows("SELECT from_status, to_status FROM application_status_history WHERE application_id = ? ORDER BY id DESC LIMIT 1", [firstApp.applicationId]))[0].to_status, "HIRED");
  await assert.rejects(withdrawCandidateApplicationService(firstApp.applicationId, { reason: "Changed my mind" }, candidate), { statusCode: 409 });
  await assert.rejects(withdrawManagedApplicationService(firstApp.applicationId, { reason: "Candidate requested it" }, recruiter), { statusCode: 409 });

  await t.test("offer rejection persists and cannot be issued or answered", async () => {
    const secondApp = await createSelectedApplication(alpha.organizationId, recruiter.id, "Second Candidate");
    const offer2 = await createOfferService({ application_id: secondApp.applicationId, ...defaultTerms }, recruiter);
    const submission = await submitOfferService(offer2.id, { workflow_id: offerWorkflowId }, recruiter);
    const rejected = await decideApprovalRequestService(submission.approval_request.id, { step_order: 1, comments: "Compensation needs review" }, manager, "REJECTED");
    assert.equal(rejected.status, "REJECTED");
    assert.equal((await rows("SELECT status FROM offers WHERE id = ?", [offer2.id]))[0].status, "REJECTED");
    await assert.rejects(issueOfferService(offer2.id, recruiter), { statusCode: 409 });
    await assert.rejects(respondToMyOfferService(offer2.id, { id: secondApp.candidateId, organization_id: alpha.organizationId }, "ACCEPTED"), { statusCode: 409 });
  });

  await t.test("candidate decline is persisted for an issued offer", async () => {
    const thirdApp = await createSelectedApplication(alpha.organizationId, recruiter.id, "Third Candidate");
    const offer3 = await createOfferService({ application_id: thirdApp.applicationId, ...defaultTerms }, recruiter);
    const submission = await submitOfferService(offer3.id, { workflow_id: offerWorkflowId }, recruiter);
    await decideApprovalRequestService(submission.approval_request.id, { step_order: 1 }, manager, "APPROVED");
    await issueOfferService(offer3.id, recruiter);
    const declined = await respondToMyOfferService(offer3.id, { id: thirdApp.candidateId, organization_id: alpha.organizationId }, "DECLINED", "Accepted another role");
    assert.equal(declined.status, "DECLINED");
    assert.equal((await rows("SELECT candidate_response_comments FROM offers WHERE id = ?", [offer3.id]))[0].candidate_response_comments, "Accepted another role");
  });
});
