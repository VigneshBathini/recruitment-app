import { createReadStream } from "node:fs";
import {
  createOnboardingService, createOnboardingTaskService,
  completeOnboardingService,
  getOnboardingDashboardService, getOnboardingDocumentFileService, getOnboardingService,
  listCandidateDocumentsService, listCandidateOnboardingService, listCandidateTasksService,
  listOnboardingService, reviewOnboardingDocumentService, updateCandidateTaskService,
  updateOnboardingService, updateOnboardingTaskService, uploadCandidateDocumentService,
} from "../services/onboarding.service.js";
import {
  createOnboardingSchema, createOnboardingTaskSchema,
  parseOnboardingId, reviewCandidateDocumentSchema, updateOnboardingSchema,
  updateOnboardingTaskSchema, uploadCandidateDocumentSchema,
} from "../schemas/onboarding.schema.js";

function sendError(error, res, next) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
}

function validate(schema, input, res) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  res.status(400).json({ success: false, message: "Validation failed", errors: result.error.flatten() });
  return null;
}

export async function getOnboardingDashboardController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await getOnboardingDashboardService(req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function listOnboardingController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listOnboardingService(req.query, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function getOnboardingController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await getOnboardingService(req.params.id, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function createOnboardingController(req, res, next) {
  const data = validate(createOnboardingSchema, req.body, res);
  if (!data) return;
  try { return res.status(201).json({ success: true, message: "Onboarding initiated", data: await createOnboardingService(data, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function updateOnboardingController(req, res, next) {
  const data = validate(updateOnboardingSchema, req.body, res);
  if (!data) return;
  try { return res.status(200).json({ success: true, message: "Onboarding updated", data: await updateOnboardingService(req.params.id, data, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function completeOnboardingController(req, res, next) {
  try {
    return res.status(200).json({ success: true, message: "Final hiring completed", data: await completeOnboardingService(req.params.id, req.user) });
  } catch (error) { return sendError(error, res, next); }
}

export async function listOnboardingTasksController(req, res, next) {
  try {
    const onboarding = await getOnboardingService(req.params.id, req.user);
    return res.status(200).json({ success: true, data: onboarding.tasks });
  } catch (error) { return sendError(error, res, next); }
}

export async function createOnboardingTaskController(req, res, next) {
  const data = validate(createOnboardingTaskSchema, req.body, res);
  if (!data) return;
  try { return res.status(201).json({ success: true, message: "Onboarding task created", data: await createOnboardingTaskService(req.params.id, data, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function updateOnboardingTaskController(req, res, next) {
  const data = validate(updateOnboardingTaskSchema, req.body, res);
  if (!data) return;
  try {
    const task = await updateOnboardingTaskService(req.params.taskId, data, req.user);
    return res.status(200).json({ success: true, message: "Onboarding task updated", data: task });
  } catch (error) { return sendError(error, res, next); }
}

export async function reviewOnboardingDocumentController(req, res, next) {
  const data = validate(reviewCandidateDocumentSchema, req.body, res);
  if (!data) return;
  try { return res.status(200).json({ success: true, message: "Document review saved", data: await reviewOnboardingDocumentService(req.params.documentId, data, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

function sendDocumentFile(file, res, next) {
  res.setHeader("Content-Type", file.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
  return createReadStream(file.path).on("error", next).pipe(res);
}

export async function getOnboardingDocumentFileController(req, res, next) {
  try {
    const file = await getOnboardingDocumentFileService(req.params.documentId, req.user.organization_id);
    return sendDocumentFile(file, res, next);
  } catch (error) { return sendError(error, res, next); }
}

export async function getMyOnboardingController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listCandidateOnboardingService(req.candidate) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function getMyOnboardingDetailsController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await getOnboardingService(req.params.id, req.candidate, req.candidate.id) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function getMyOnboardingTasksController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listCandidateTasksService(req.params.id, req.candidate) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function updateMyOnboardingTaskController(req, res, next) {
  const data = validate(updateOnboardingTaskSchema, req.body, res);
  if (!data) return;
  try {
    await updateCandidateTaskService(req.params.taskId, data, req.candidate);
    return res.status(200).json({ success: true, message: "Onboarding task updated", data: { id: parseOnboardingId(req.params.taskId) } });
  } catch (error) { return sendError(error, res, next); }
}

export async function listMyOnboardingDocumentsController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listCandidateDocumentsService(req.params.id, req.candidate) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function uploadMyOnboardingDocumentController(req, res, next) {
  const metadata = validate(uploadCandidateDocumentSchema, { document_type: req.query.document_type, file_name: req.query.file_name }, res);
  if (!metadata) return;
  try {
    const data = await uploadCandidateDocumentService(req.params.id, { ...metadata, mime_type: req.headers["content-type"] }, req.body, req.candidate);
    return res.status(201).json({ success: true, message: "Document uploaded for review", data });
  } catch (error) { return sendError(error, res, next); }
}

export async function getMyOnboardingDocumentFileController(req, res, next) {
  try {
    const file = await getOnboardingDocumentFileService(req.params.documentId, req.candidate.organization_id, req.candidate.id);
    return sendDocumentFile(file, res, next);
  } catch (error) { return sendError(error, res, next); }
}
