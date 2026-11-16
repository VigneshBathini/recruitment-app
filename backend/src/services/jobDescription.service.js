import {
  decideApprovalRequestService,
  getApprovalWorkflowsService,
  submitApprovalRequestService,
} from "./approval.service.js";
import {
  createJobDescriptionFromRequirement,
  getAllJobDescriptions,
  getJobDescriptionApprovalHistory,
  getJobDescriptionById,
  getJobDescriptionByIdForPlatform,
  getJobDescriptionsByOrganization,
  getPendingJobApprovalRequestId,
  publishJobDescription,
  updateJobDescriptionDraft,
} from "../repositories/jobDescription.repository.js";
import {
  parseJobDescriptionId,
  validateJobDescriptionDecision,
  validateJobDescriptionDraft,
  validateJobDescriptionSubmission,
} from "../schemas/jobDescription.schema.js";

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function createJobDescriptionService(requirementId, user) {
  return createJobDescriptionFromRequirement(
    parseJobDescriptionId(requirementId, "requirement id"),
    user.organization_id
  );
}

export async function getJobDescriptionsService(user) {
  if (user.account_type === "platform_admin") return getAllJobDescriptions();
  return getJobDescriptionsByOrganization(user.organization_id);
}

export async function getJobDescriptionService(id, user) {
  const jobId = parseJobDescriptionId(id);
  const job = user.account_type === "platform_admin"
    ? await getJobDescriptionByIdForPlatform(jobId)
    : await getJobDescriptionById(jobId, user.organization_id);
  if (!job) throw createError("JD not found", 404);
  return job;
}

export async function updateJobDescriptionService(id, data, user) {
  const job = await updateJobDescriptionDraft(
    parseJobDescriptionId(id),
    user.organization_id,
    validateJobDescriptionDraft(data)
  );
  if (!job) {
    throw createError("JD not found or cannot be edited unless it is DRAFT or REJECTED", 409);
  }
  return job;
}

export async function submitJobDescriptionService(id, data, user) {
  const jobId = parseJobDescriptionId(id);
  const submission = validateJobDescriptionSubmission(data);
  const job = await getJobDescriptionById(jobId, user.organization_id);
  if (!job) throw createError("JD not found", 404);
  if (job.status !== "DRAFT" && job.status !== "REJECTED") {
    throw createError("JD cannot be submitted from its current status", 409);
  }
  validateJobDescriptionDraft({ title: job.title, jd_content: job.jd_content });
  const workflows = await getApprovalWorkflowsService("JOB", user);
  if (!workflows.length) {
    throw createError("No active JOB approval workflow is configured for this organization", 409);
  }
  if (!workflows.some((workflow) => Number(workflow.id) === submission.workflow_id)) {
    throw createError("The selected JOB approval workflow is not active for this organization", 409);
  }
  return submitApprovalRequestService({
    workflow_id: submission.workflow_id,
    entity_type: "JOB",
    entity_id: jobId,
  }, user);
}

export async function decideJobDescriptionService(id, data, user, decision) {
  const jobId = parseJobDescriptionId(id);
  const job = await getJobDescriptionById(jobId, user.organization_id);
  if (!job) throw createError("JD not found", 404);
  if (job.status !== "PENDING_APPROVAL") {
    throw createError("JD is not pending approval", 409);
  }

  const requestId = await getPendingJobApprovalRequestId(jobId, user.organization_id);
  if (!requestId) throw createError("Pending JD approval request not found", 404);
  const decisionData = validateJobDescriptionDecision(data, decision);
  return decideApprovalRequestService(requestId, decisionData, user, decision);
}

export async function getJobDescriptionApprovalHistoryService(id, user) {
  const jobId = parseJobDescriptionId(id);
  const job = user.account_type === "platform_admin"
    ? await getJobDescriptionByIdForPlatform(jobId)
    : await getJobDescriptionById(jobId, user.organization_id);
  if (!job) throw createError("JD not found", 404);
  return getJobDescriptionApprovalHistory(jobId, job.organization_id);
}

export async function publishJobDescriptionService(id, user) {
  return publishJobDescription(
    parseJobDescriptionId(id),
    user.organization_id
  );
}
