import {
  getApplicationDashboardCounts,
  getApplicationDetails,
  getApplicationResumeKey,
  getApplicationReviewDetails,
  listApplicationReviewQueue,
  decideOnApplication,
  listApplications,
  updateApplicationProgress,
} from "../repositories/application.repository.js";
import { getCandidateResumeFile } from "./candidate-resume-storage.js";

const stages = new Set(["SCREENING", "PHONE_SCREEN", "TECHNICAL_INTERVIEW", "HR_INTERVIEW", "OFFER"]);

function serviceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw serviceError("Application ID must be a positive integer", 400);
  return id;
}

export function parseApplicationListQuery(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.page_size === undefined ? 20 : Number(query.page_size);
  const status = query.status ? String(query.status).trim().toUpperCase() : undefined;
  const stage = query.stage ? String(query.stage).trim().toUpperCase() : undefined;
  const search = query.search ? String(query.search).trim().slice(0, 150) : undefined;
  if (!Number.isSafeInteger(page) || page < 1) throw serviceError("page must be a positive integer", 400);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw serviceError("page_size must be between 1 and 100", 400);
  if (status && !["APPLIED", "SCREENING", "SHORTLISTED", "REJECTED", "HIRED"].includes(status)) throw serviceError("Unsupported application status filter", 400);
  if (stage && !stages.has(stage)) throw serviceError("Unsupported screening stage filter", 400);
  return { page, pageSize, status, stage, search, offset: (page - 1) * pageSize };
}

export async function getApplicationDashboardService(organizationId) {
  return getApplicationDashboardCounts(organizationId);
}

export async function listApplicationsService(organizationId, query) {
  const parsed = parseApplicationListQuery(query);
  const result = await listApplications({ organizationId, ...parsed, limit: parsed.pageSize });
  return {
    ...result,
    page: parsed.page,
    page_size: parsed.pageSize,
    total_pages: Math.ceil(result.total / parsed.pageSize),
  };
}

export async function getApplicationDetailsService(idValue, organizationId) {
  const application = await getApplicationDetails(parseId(idValue), organizationId);
  if (!application) throw serviceError("Application not found", 404);
  return application;
}

export async function getApplicationResumeFileService(idValue, organizationId) {
  const id = parseId(idValue);
  const application = await getApplicationResumeKey(id, organizationId);
  if (!application) throw serviceError("Application not found", 404);
  if (!application.resume_url) throw serviceError("No resume was submitted with this application", 404);
  return getCandidateResumeFile(application.resume_url);
}

function requireHiringManager(user) {
  if (Number(user.role_id) !== 3) throw serviceError("Hiring Manager role is required", 403);
}

export async function getApplicationReviewQueueService(user) {
  requireHiringManager(user);
  return listApplicationReviewQueue(user.organization_id);
}

export async function getApplicationReviewDetailsService(idValue, user) {
  requireHiringManager(user);
  const application = await getApplicationReviewDetails(parseId(idValue), user.organization_id);
  if (!application) throw serviceError("Application not found", 404);
  if (!application.completed_interviews.length) throw serviceError("A completed interview is required before review", 409);
  return application;
}

export async function decideOnApplicationService(idValue, data, user) {
  requireHiringManager(user);
  const decision = typeof data.decision === "string" ? data.decision.trim().toUpperCase() : "";
  if (!["SELECTED", "REJECTED"].includes(decision)) throw serviceError("decision must be SELECTED or REJECTED", 400);
  const comments = typeof data.comments === "string" ? data.comments.trim() : "";
  if (!comments) throw serviceError("A nonempty decision comment is required", 400);
  if (comments.length > 5000) throw serviceError("Comments cannot exceed 5000 characters", 400);
  const application = await decideOnApplication({ applicationId: parseId(idValue), organizationId: user.organization_id, userId: user.id, decision, comments });
  if (!application) throw serviceError("Application not found", 404);
  return application;
}

async function changeProgress(idValue, data, user, targetStatus, targetStage) {
  const isFinalDecision = ["SHORTLISTED", "REJECTED"].includes(targetStatus);
  const decisionComments = isFinalDecision ? data.comments?.trim() ?? null : null;
  if (isFinalDecision && !decisionComments) {
    throw serviceError("Comments are required when shortlisting or rejecting an application", 400);
  }
  if (decisionComments && decisionComments.length > 5000) throw serviceError("Comments cannot exceed 5000 characters", 400);
  const application = await updateApplicationProgress({
    applicationId: parseId(idValue),
    organizationId: user.organization_id,
    userId: user.id,
    status: targetStatus,
    stage: targetStage,
    decisionComments,
  });
  if (!application) throw serviceError("Application not found", 404);
  return application;
}

export function moveApplicationToStageService(id, data, user) {
  const stage = typeof data.stage === "string" ? data.stage.trim().toUpperCase() : "";
  if (!stages.has(stage)) throw serviceError("A valid screening stage is required", 400);
  return changeProgress(id, { ...data, comments: data.comments ?? null }, user, "SCREENING", stage);
}

export function shortlistApplicationService(id, data, user) {
  return changeProgress(id, data, user, "SHORTLISTED", "SHORTLISTED");
}

export function rejectApplicationService(id, data, user) {
  return changeProgress(id, data, user, "REJECTED", "REJECTED");
}
