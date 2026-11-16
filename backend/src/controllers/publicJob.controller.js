import { getPublicJobService, getPublicJobsService } from "../services/publicJob.service.js";

function handleError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  return next(error);
}

export async function getPublicJobsController(req, res, next) {
  try {
    const jobs = await getPublicJobsService(req.params.organizationSlug);
    return res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function getPublicJobController(req, res, next) {
  try {
    const job = await getPublicJobService(req.params.organizationSlug, req.params.jobId);
    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    return handleError(error, res, next);
  }
}
