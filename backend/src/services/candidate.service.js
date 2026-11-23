import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createCandidate,
  createCandidateApplication,
  findCandidateForLogin,
  getCandidateApplications,
  getCandidateProfile,
  updateCandidateProfile,
  updateCandidateResume,
} from "../repositories/candidate.repository.js";
import { getCandidateResumeFile, removeCandidateResume, storeCandidateResume } from "./candidate-resume-storage.js";

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function signCandidateToken(candidate) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw createError("Authentication service is not configured", 500);
  return jwt.sign(
    {
      sub: String(candidate.id),
      organization_id: Number(candidate.organization_id),
      account_type: "candidate",
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );
}

function candidateResponse(candidate) {
  return {
    id: Number(candidate.id),
    account_type: "candidate",
    organization_id: Number(candidate.organization_id),
    organization_slug: candidate.organization_slug,
    first_name: candidate.first_name,
    last_name: candidate.last_name,
    email: candidate.email,
    phone: candidate.phone ?? null,
    resume_url: candidate.resume_url ? "/api/candidates/me/resume/file" : null,
  };
}

export async function registerCandidate(data) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  let candidate;
  try {
    candidate = await createCandidate({
      organizationSlug: data.organization_slug,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      passwordHash,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw createError("A candidate with this email already exists in this organization", 409);
    }
    throw error;
  }
  if (!candidate) throw createError("Active organization not found", 404);
  candidate.organization_slug = data.organization_slug;
  return { token: signCandidateToken(candidate), candidate: candidateResponse(candidate) };
}

export async function loginCandidate(data) {
  const candidate = await findCandidateForLogin(data.email, data.organization_slug);
  if (!candidate || Number(candidate.is_active) !== 1 || !(await bcrypt.compare(data.password, candidate.password_hash))) {
    throw createError("Invalid organization, email, or password", 401);
  }
  if (Number(candidate.organization_is_active) !== 1) {
    throw createError("This organization is inactive", 403);
  }
  return { token: signCandidateToken(candidate), candidate: candidateResponse(candidate) };
}

export async function getCandidateProfileService(candidateId, organizationId) {
  const candidate = await getCandidateProfile(candidateId, organizationId);
  if (!candidate) throw createError("Candidate not found", 404);
  return { ...candidate, resume_url: candidate.resume_url ? "/api/candidates/me/resume/file" : null };
}

export async function updateCandidateProfileService(candidateId, organizationId, data) {
  const profileData = {};
  for (const field of ["first_name", "last_name", "phone"]) {
    if (Object.hasOwn(data, field)) profileData[field] = data[field];
  }
  const candidate = await updateCandidateProfile(candidateId, organizationId, profileData);
  if (!candidate) throw createError("Candidate not found", 404);
  return { ...candidate, resume_url: candidate.resume_url ? "/api/candidates/me/resume/file" : null };
}

export async function uploadCandidateResumeService(file, mimeType, fileName, candidate) {
  let storageKey;
  try {
    storageKey = await storeCandidateResume(file, mimeType, fileName);
    const updated = await updateCandidateResume(candidate.id, candidate.organization_id, storageKey);
    if (!updated) throw createError("Candidate profile not found", 404);
    // Keep previous resume files: applications submitted against them retain their snapshot.
    return { resume_url: "/api/candidates/me/resume/file", file_name: `resume${storageKey.slice(storageKey.lastIndexOf("."))}` };
  } catch (error) {
    await removeCandidateResume(storageKey);
    throw error;
  }
}

export async function getCandidateResumeFileService(candidate) {
  const profile = await getCandidateProfile(candidate.id, candidate.organization_id);
  if (!profile) throw createError("Candidate not found", 404);
  if (!profile.resume_url) throw createError("No resume has been uploaded", 404);
  return getCandidateResumeFile(profile.resume_url);
}

export async function applyToJobService(candidateId, organizationId, jobId) {
  try {
    const result = await createCandidateApplication(candidateId, organizationId, jobId);
    if (result.error === "candidate_not_found") throw createError("Candidate not found", 404);
    if (result.error === "job_not_found") throw createError("Published job not found in this organization", 404);
    return result;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") throw createError("You have already applied to this job", 409);
    throw error;
  }
}

export async function getCandidateApplicationsService(candidateId, organizationId) {
  return getCandidateApplications(candidateId, organizationId);
}
