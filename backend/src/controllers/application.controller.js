import {
  getApplicationDashboardService,
  getApplicationDetailsService,
  getApplicationReviewQueueService,
  getApplicationReviewDetailsService,
  decideOnApplicationService,
  listApplicationsService,
  moveApplicationToStageService,
  rejectApplicationService,
  shortlistApplicationService,
} from "../services/application.service.js";

function sendError(error, res, next) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
}

export async function getApplicationDashboardController(req, res, next) {
  try {
    const data = await getApplicationDashboardService(req.user.organization_id);
    return res.status(200).json({ success: true, data });
  } catch (error) { return sendError(error, res, next); }
}

export async function listApplicationsController(req, res, next) {
  try {
    const data = await listApplicationsService(req.user.organization_id, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) { return sendError(error, res, next); }
}

export async function getApplicationDetailsController(req, res, next) {
  try {
    const data = await getApplicationDetailsService(req.params.id, req.user.organization_id);
    return res.status(200).json({ success: true, data });
  } catch (error) { return sendError(error, res, next); }
}

export async function getApplicationReviewQueueController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await getApplicationReviewQueueService(req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function getApplicationReviewDetailsController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await getApplicationReviewDetailsService(req.params.id, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function decideOnApplicationController(req, res, next) {
  try { return res.status(200).json({ success: true, message: "Application decision recorded", data: await decideOnApplicationService(req.params.id, req.body, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export function validateDecisionBody(req, res, next) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ success: false, message: "Request body must be an object" });
  if (req.body.decision !== undefined && typeof req.body.decision !== "string") return res.status(400).json({ success: false, message: "decision must be a string" });
  if (req.body.comments !== undefined && typeof req.body.comments !== "string") return res.status(400).json({ success: false, message: "comments must be a string" });
  return next();
}

function validateProgressBody(req, res, next) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ success: false, message: "Request body must be an object" });
  }
  if (req.body.comments !== undefined && req.body.comments !== null && typeof req.body.comments !== "string") {
    return res.status(400).json({ success: false, message: "comments must be a string" });
  }
  return next();
}

export async function moveApplicationToStageController(req, res, next) {
  try {
    const data = await moveApplicationToStageService(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: "Application moved to screening stage", data });
  } catch (error) { return sendError(error, res, next); }
}

export async function shortlistApplicationController(req, res, next) {
  try {
    const data = await shortlistApplicationService(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: "Candidate shortlisted", data });
  } catch (error) { return sendError(error, res, next); }
}

export async function rejectApplicationController(req, res, next) {
  try {
    const data = await rejectApplicationService(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: "Application rejected", data });
  } catch (error) { return sendError(error, res, next); }
}

export { validateProgressBody };
