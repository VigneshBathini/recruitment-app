import path from "node:path";
import {
  createCandidateDocument, createOnboardingRecord, createOnboardingTask,
  completeOnboardingAndHire,
  getOnboardingDashboard, getOnboardingDocumentStorage, getOnboardingRecord,
  listOnboardingDocuments, listOnboardingRecords, listOnboardingTasks,
  reviewCandidateDocument, updateOnboardingRecord, updateOnboardingTask,
} from "../repositories/onboarding.repository.js";
import { removeOnboardingDocument, resolveOnboardingDocument, storeOnboardingDocument } from "./onboarding-file-storage.js";
import { parseOnboardingId } from "../schemas/onboarding.schema.js";
import { getPermissionsByRoleId } from "../repositories/permission.repository.js";

function serviceError(message, statusCode) { const error = new Error(message); error.statusCode = statusCode; return error; }

function addDownloadUrl(document, candidate = false) {
  const { storage_key: _storageKey, ...safeDocument } = document;
  return { ...safeDocument, download_url: candidate
    ? `/api/candidates/me/onboarding/documents/${document.id}/file`
    : `/api/onboarding/documents/${document.id}/file` };
}

function parseListQuery(query) {
  const search = query.search === undefined ? undefined : String(query.search).trim().slice(0, 150);
  const status = query.status === undefined ? undefined : String(query.status).trim().toUpperCase();
  if (status && !["INITIATED", "IN_PROGRESS", "READY_TO_JOIN", "COMPLETED", "CANCELLED"].includes(status)) {
    throw serviceError("Unsupported onboarding status filter", 400);
  }
  return { search: search || undefined, status };
}

export async function getOnboardingDashboardService(user) {
  return getOnboardingDashboard(user.organization_id);
}

export async function listOnboardingService(query, user) {
  return listOnboardingRecords({ organizationId: user.organization_id, ...parseListQuery(query) });
}

export async function getOnboardingService(idValue, user, candidateId = null) {
  const id = parseOnboardingId(idValue);
  const record = await getOnboardingRecord(id, user.organization_id, candidateId);
  if (!record) throw serviceError("Onboarding record not found", 404);
  const [tasks, documents] = await Promise.all([
    listOnboardingTasks(id, user.organization_id, candidateId),
    listOnboardingDocuments(id, user.organization_id, candidateId),
  ]);
  return { ...record, tasks, documents: documents.map((document) => addDownloadUrl(document, candidateId != null)) };
}

export async function createOnboardingService(data, user) {
  const result = await createOnboardingRecord({
    organizationId: user.organization_id, offerId: data.offer_id, userId: user.id,
    targetJoinDate: data.target_join_date, notes: data.notes,
  });
  if (result.error === "offer_not_found") throw serviceError("Offer not found in this organization", 404);
  if (result.error === "offer_not_accepted") throw serviceError("Onboarding can only be initiated from an ACCEPTED offer", 409);
  if (result.error === "duplicate") throw serviceError("Onboarding already exists for this offer", 409);
  return getOnboardingService(result.id, user);
}

export async function updateOnboardingService(idValue, data, user) {
  const result = await updateOnboardingRecord(parseOnboardingId(idValue), user.organization_id, data);
  if (result.error === "not_found") throw serviceError("Onboarding record not found", 404);
  if (result.error === "invalid_transition") throw serviceError("Onboarding status transition is not allowed", 409);
  return getOnboardingService(idValue, user);
}

export async function completeOnboardingService(idValue, user) {
  const id = parseOnboardingId(idValue);
  const permissions = await getPermissionsByRoleId(user.organization_id, user.role_id);
  if (!permissions.some((permission) => permission.name === "onboarding.complete")) {
    throw serviceError("Missing required permission: onboarding.complete", 403);
  }
  const result = await completeOnboardingAndHire(id, user.organization_id, user.id);
  const errors = {
    not_found: ["Onboarding record not found", 404],
    not_selected: ["Final hiring requires an application decision of SELECTED", 409],
    offer_not_accepted: ["Final hiring requires an ACCEPTED offer", 409],
    invalid_onboarding_status: ["Onboarding must be READY_TO_JOIN before final hiring", 409],
    already_hired: ["This application has already been hired", 409],
  };
  if (result.error) {
    const [message, statusCode] = errors[result.error] ?? ["Unable to complete onboarding", 409];
    throw serviceError(message, statusCode);
  }
  return result;
}

export async function createOnboardingTaskService(idValue, data, user) {
  const result = await createOnboardingTask(parseOnboardingId(idValue), user.organization_id, data);
  if (result.error === "onboarding_not_found") throw serviceError("Onboarding record not found", 404);
  if (result.error === "invalid_candidate_assignee") throw serviceError("Candidate assignee must be this onboarding candidate in the same organization", 400);
  if (result.error === "invalid_user_assignee") throw serviceError("Employee assignee must be active, belong to this organization, and have onboarding.manage", 400);
  return (await listOnboardingTasks(parseOnboardingId(idValue), user.organization_id)).find((task) => Number(task.id) === Number(result.id));
}

export async function updateOnboardingTaskService(taskIdValue, data, user) {
  const result = await updateOnboardingTask(parseOnboardingId(taskIdValue), user.organization_id, data, { userId: user.id });
  if (result.error === "not_found") throw serviceError("Onboarding task not found", 404);
  if (result.error === "invalid_transition") throw serviceError("Task status transition is not allowed", 409);
  if (result.error === "forbidden") throw serviceError("Candidates can only update task status and comments", 403);
  if (result.error === "dual_assignment") throw serviceError("A task cannot be assigned to both a candidate and an employee", 400);
  if (result.error === "invalid_candidate_assignee") throw serviceError("Candidate assignee must be this onboarding candidate in the same organization", 400);
  if (result.error === "invalid_user_assignee") throw serviceError("Employee assignee must be active, belong to this organization, and have onboarding.manage", 400);
  return (await listOnboardingTasks(result.onboardingId, user.organization_id)).find((task) => Number(task.id) === Number(taskIdValue));
}

export async function listCandidateOnboardingService(candidate) {
  return listOnboardingRecords({ organizationId: candidate.organization_id, candidateId: candidate.id });
}

export async function listCandidateTasksService(onboardingIdValue, candidate) {
  const id = parseOnboardingId(onboardingIdValue);
  const record = await getOnboardingRecord(id, candidate.organization_id, candidate.id);
  if (!record) throw serviceError("Onboarding record not found", 404);
  return listOnboardingTasks(id, candidate.organization_id, candidate.id);
}

export async function updateCandidateTaskService(taskIdValue, data, candidate) {
  if (Object.keys(data).some((key) => !["status", "comments"].includes(key))) throw serviceError("Candidates can only update task status and comments", 403);
  if (data.status === "CANCELLED") throw serviceError("Candidates cannot cancel onboarding tasks", 403);
  const result = await updateOnboardingTask(parseOnboardingId(taskIdValue), candidate.organization_id, data, { candidateId: candidate.id });
  if (result.error === "not_found") throw serviceError("Onboarding task not found", 404);
  if (result.error === "invalid_transition") throw serviceError("Task status transition is not allowed", 409);
  return result;
}

export async function listCandidateDocumentsService(onboardingIdValue, candidate) {
  const id = parseOnboardingId(onboardingIdValue);
  const record = await getOnboardingRecord(id, candidate.organization_id, candidate.id);
  if (!record) throw serviceError("Onboarding record not found", 404);
  const documents = await listOnboardingDocuments(id, candidate.organization_id, candidate.id);
  return documents.map((document) => addDownloadUrl(document, true));
}

function safeFileName(fileName) {
  const basename = path.basename(String(fileName).replace(/\\/g, "/")).replace(/[\x00-\x1f\x7f]/g, "").trim();
  if (!basename || basename === "." || basename === "..") throw serviceError("Invalid file name", 400);
  return basename.slice(0, 255);
}

export async function uploadCandidateDocumentService(onboardingIdValue, query, file, candidate) {
  const id = parseOnboardingId(onboardingIdValue);
  if (!Buffer.isBuffer(file)) throw serviceError("Upload the file as an application/octet-stream request body", 400);
  const fileName = safeFileName(query.file_name);
  const record = await getOnboardingRecord(id, candidate.organization_id, candidate.id);
  if (!record) throw serviceError("Onboarding record not found", 404);
  let storageKey;
  try {
    storageKey = await storeOnboardingDocument(file, query.mime_type);
    const result = await createCandidateDocument({
      onboardingId: id, organizationId: candidate.organization_id, candidateId: candidate.id,
      documentType: query.document_type, fileName, storageKey, mimeType: query.mime_type, fileSize: file.length,
    });
    if (result.error === "not_found") throw serviceError("Onboarding record not found", 404);
    return { id: result.id, onboarding_id: id, document_type: query.document_type, file_name: fileName,
      mime_type: query.mime_type, file_size: file.length, review_status: "PENDING", is_primary: 1,
      download_url: `/api/candidates/me/onboarding/documents/${result.id}/file` };
  } catch (error) {
    await removeOnboardingDocument(storageKey);
    throw error;
  }
}

export async function reviewOnboardingDocumentService(idValue, data, user) {
  const documentId = parseOnboardingId(idValue);
  const updated = await reviewCandidateDocument(documentId, user.organization_id, user.id, data.review_status, data.rejection_reason);
  if (!updated) throw serviceError("Pending or rejected onboarding document not found", 404);
  const document = await getOnboardingDocumentStorage(documentId, user.organization_id);
  if (!document) throw serviceError("Onboarding document not found", 404);
  return addDownloadUrl(document);
}

export async function getOnboardingDocumentFileService(idValue, organizationId, candidateId = null) {
  const document = await getOnboardingDocumentStorage(parseOnboardingId(idValue), organizationId, candidateId);
  if (!document) throw serviceError("Onboarding document not found", 404);
  return { ...document, path: resolveOnboardingDocument(document.storage_key) };
}

export async function listOnboardingWithCandidateService(query, candidate) {
  return listOnboardingRecords({ organizationId: candidate.organization_id, candidateId: candidate.id, ...parseListQuery(query) });
}

