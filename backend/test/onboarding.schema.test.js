import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionOnboardingStatus, canTransitionOnboardingTaskStatus,
  createOnboardingTaskSchema, reviewCandidateDocumentSchema, updateOnboardingSchema,
  uploadCandidateDocumentSchema,
} from "../src/schemas/onboarding.schema.js";
import { validateDocumentUpload } from "../src/services/onboarding-file-storage.js";

test("onboarding supports only the declared statuses and forward transitions", () => {
  assert.equal(updateOnboardingSchema.safeParse({ status: "READY_TO_JOIN" }).success, true);
  assert.equal(updateOnboardingSchema.safeParse({ status: "HIRED" }).success, false);
  assert.equal(canTransitionOnboardingStatus("INITIATED", "IN_PROGRESS"), true);
  assert.equal(canTransitionOnboardingStatus("READY_TO_JOIN", "COMPLETED"), false);
  assert.equal(updateOnboardingSchema.safeParse({ status: "COMPLETED" }).success, false);
  assert.equal(canTransitionOnboardingStatus("COMPLETED", "IN_PROGRESS"), false);
  assert.equal(canTransitionOnboardingStatus("CANCELLED", "COMPLETED"), false);
});

test("task assignment requires exactly one same-kind assignee", () => {
  assert.equal(createOnboardingTaskSchema.safeParse({ title: "Upload ID", assigned_to_candidate_id: 3 }).success, true);
  assert.equal(createOnboardingTaskSchema.safeParse({ title: "Prepare laptop", assigned_to_user_id: 7 }).success, true);
  assert.equal(createOnboardingTaskSchema.safeParse({ title: "Invalid", assigned_to_candidate_id: 3, assigned_to_user_id: 7 }).success, false);
  assert.equal(createOnboardingTaskSchema.safeParse({ title: "Unassigned" }).success, false);
  assert.equal(canTransitionOnboardingTaskStatus("PENDING", "COMPLETED"), true);
  assert.equal(canTransitionOnboardingTaskStatus("COMPLETED", "IN_PROGRESS"), false);
});

test("document review rejection requires a reason", () => {
  assert.equal(reviewCandidateDocumentSchema.safeParse({ review_status: "VERIFIED" }).success, true);
  assert.equal(reviewCandidateDocumentSchema.safeParse({ review_status: "REJECTED" }).success, false);
  assert.equal(reviewCandidateDocumentSchema.safeParse({ review_status: "REJECTED", rejection_reason: "Unreadable scan" }).success, true);
});

test("upload metadata and bytes are constrained to supported document types", () => {
  assert.equal(uploadCandidateDocumentSchema.safeParse({ document_type: "IDENTITY", file_name: "id.pdf" }).success, true);
  assert.equal(uploadCandidateDocumentSchema.safeParse({ document_type: "../", file_name: "id.pdf" }).success, false);
  assert.doesNotThrow(() => validateDocumentUpload(Buffer.from("%PDF-1.7\n"), "application/pdf"));
  assert.throws(() => validateDocumentUpload(Buffer.from("not a pdf"), "application/pdf"), /content does not match/);
  assert.throws(() => validateDocumentUpload(Buffer.from("%PDF-1.7"), "text/plain"), /Only PDF/);
});
