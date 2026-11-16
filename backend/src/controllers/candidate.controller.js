import {
  applyToJobService,
  getCandidateApplicationsService,
  getCandidateProfileService,
  loginCandidate,
  registerCandidate,
  updateCandidateProfileService,
} from "../services/candidate.service.js";
import {
  candidateApplicationSchema,
  candidateLoginSchema,
  candidateProfileUpdateSchema,
  candidateRegistrationSchema,
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
  } catch (error) { return sendError(error, res, next); }
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
