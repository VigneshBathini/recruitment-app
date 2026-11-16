import {
  getPublishedJobByOrganizationSlug,
  getPublishedJobsByOrganizationSlug,
} from "../repositories/publicJob.repository.js";

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseOrganizationSlug(value) {
  if (typeof value !== "string") throw validationError("Invalid organization slug");
  const slug = value.trim().toLowerCase();
  if (slug.length < 2 || slug.length > 150 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw validationError("Invalid organization slug");
  }
  return slug;
}

function parseJobId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw validationError("Job ID must be a positive integer");
  }
  return id;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

export async function getPublicJobsService(organizationSlug) {
  const jobs = await getPublishedJobsByOrganizationSlug(parseOrganizationSlug(organizationSlug));
  if (jobs === null) throw notFound("Organization not found");
  return jobs;
}

export async function getPublicJobService(organizationSlug, jobId) {
  const job = await getPublishedJobByOrganizationSlug(
    parseOrganizationSlug(organizationSlug),
    parseJobId(jobId)
  );
  if (!job) throw notFound("Published job not found");
  return job;
}
