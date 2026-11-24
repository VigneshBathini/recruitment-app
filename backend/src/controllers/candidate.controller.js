import { createReadStream } from "node:fs";
import {
  applyToJobService,
  getCandidateApplicationsService,
  getCandidateProfileService,
  loginCandidate,
  registerCandidate,
  updateCandidateProfileService,
  uploadCandidateResumeService,
  getCandidateResumeFileService,
} from "../services/candidate.service.js";
import {
  getMyOfferService,
  listMyOffersService,
  respondToMyOfferService,
} from "../services/candidate-offer.service.js";
import { withdrawCandidateApplicationService } from "../services/application.service.js";
import {
  candidateApplicationSchema,
  candidateLoginSchema,
  candidateProfileUpdateSchema,
  candidateRegistrationSchema,
  candidateOfferResponseSchema,
} from "../schemas/candidate.schema.js";

function sendError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  return next(error);
}

function validate(schema, body, res) {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  res.status(400).json({ success: false, message: "Validation failed", errors: result.error.flatten() });
  return null;
}

export async function registerCandidateController(req, res, next) {
  const data = validate(candidateRegistrationSchema, req.body, res);
  if (!data) return;
  try {
    const result = await registerCandidate(data);
    return res.status(201).json({ success: true, message: "Candidate registered successfully", data: result });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, message: "Unable to complete registration with these details" });
    }
    return sendError(error, res, next);
  }
}

export async function loginCandidateController(req, res, next) {
  const data = validate(candidateLoginSchema, req.body, res);
  if (!data) return;
  try {
    const result = await loginCandidate(data);
    return res.status(200).json({ success: true, message: "Candidate login successful", data: result });
  } catch (error) { return sendError(error, res, next); }
}

export async function getCandidateProfileController(req, res, next) {
  try {
    const profile = await getCandidateProfileService(req.candidate.id, req.candidate.organization_id);
    return res.status(200).json({ success: true, data: profile });
  } catch (error) { return sendError(error, res, next); }
}

export async function updateCandidateProfileController(req, res, next) {
  const data = validate(candidateProfileUpdateSchema, req.body, res);
  if (!data) return;
  try {
    const profile = await updateCandidateProfileService(req.candidate.id, req.candidate.organization_id, data);
    return res.status(200).json({ success: true, message: "Candidate profile updated", data: profile });
  } catch (error) { return sendError(error, res, next); }
}

export async function uploadCandidateResumeController(req, res, next) {
  const fileName = req.query.file_name;
  if (typeof fileName !== "string" || !fileName.trim()) return res.status(400).json({ success: false, message: "file_name is required" });
  try {
    const data = await uploadCandidateResumeService(req.body, req.headers["content-type"], fileName, req.candidate);
    return res.status(200).json({ success: true, message: "Resume uploaded successfully", data });
  } catch (error) { return sendError(error, res, next); }
}

export async function getCandidateResumeFileController(req, res, next) {
  try {
    const file = await getCandidateResumeFileService(req.candidate);
    res.setHeader("Content-Type", file.mime_type);
    res.setHeader("Content-Length", file.file_size);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
    return createReadStream(file.path).on("error", next).pipe(res);
  } catch (error) { return sendError(error, res, next); }
}

export async function applyToJobController(req, res, next) {
  const data = validate(candidateApplicationSchema, req.body, res);
  if (!data) return;
  try {
    const application = await applyToJobService(req.candidate.id, req.candidate.organization_id, data.job_id);
    return res.status(201).json({ success: true, message: "Application submitted", data: application });
  } catch (error) { return sendError(error, res, next); }
}

export async function getCandidateApplicationsController(req, res, next) {
  try {
    const applications = await getCandidateApplicationsService(req.candidate.id, req.candidate.organization_id);
    return res.status(200).json({ success: true, data: applications });
  } catch (error) { return sendError(error, res, next); }
}

export async function withdrawCandidateApplicationController(req, res, next) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || typeof req.body.reason !== "string") {
    return res.status(400).json({ success: false, message: "A withdrawal reason is required" });
  }
  try {
    const application = await withdrawCandidateApplicationService(req.params.id, req.body, req.candidate);
    return res.status(200).json({ success: true, message: "Application withdrawn", data: application });
  } catch (error) { return sendError(error, res, next); }
}

export async function getCandidateOffersController(req, res, next) {
  try {
    const offers = await listMyOffersService(req.candidate);
    return res.status(200).json({ success: true, data: offers });
  } catch (error) { return sendError(error, res, next); }
}

export async function getCandidateOfferController(req, res, next) {
  try {
    const offer = await getMyOfferService(req.params.id, req.candidate);
    return res.status(200).json({ success: true, data: offer });
  } catch (error) { return sendError(error, res, next); }
}

async function respondToCandidateOfferController(req, res, next, status, message) {
  const data = validate(candidateOfferResponseSchema, req.body ?? {}, res);
  if (!data) return;
  try {
    const offer = await respondToMyOfferService(req.params.id, req.candidate, status, data.comments);
    return res.status(200).json({ success: true, message, data: offer });
  } catch (error) { return sendError(error, res, next); }
}

export async function acceptCandidateOfferController(req, res, next) {
  return respondToCandidateOfferController(req, res, next, "ACCEPTED", "Offer accepted");
}

export async function declineCandidateOfferController(req, res, next) {
  return respondToCandidateOfferController(req, res, next, "DECLINED", "Offer declined");
}
