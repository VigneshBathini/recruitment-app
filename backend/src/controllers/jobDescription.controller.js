import {
  createJobDescriptionService,
  decideJobDescriptionService,
  getJobDescriptionApprovalHistoryService,
  getJobDescriptionService,
  getJobDescriptionsService,
  publishJobDescriptionService,
  submitJobDescriptionService,
  updateJobDescriptionService,
} from "../services/jobDescription.service.js";

export async function createJobDescriptionController(req, res, next) {
  try {
    const job = await createJobDescriptionService(req.params.requirementId, req.user);
    return res.status(201).json({ success: true, message: "JD draft created successfully", data: job });
  } catch (error) {
    next(error);
  }
}

export async function getJobDescriptionsController(req, res, next) {
  try {
    const jobs = await getJobDescriptionsService(req.user);
    return res.status(200).json({ success: true, message: "JDs fetched successfully", data: jobs });
  } catch (error) {
    next(error);
  }
}

export async function getJobDescriptionController(req, res, next) {
  try {
    const job = await getJobDescriptionService(req.params.id, req.user);
    return res.status(200).json({ success: true, message: "JD fetched successfully", data: job });
  } catch (error) {
    next(error);
  }
}

export async function updateJobDescriptionController(req, res, next) {
  try {
    const job = await updateJobDescriptionService(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: "JD draft updated successfully", data: job });
  } catch (error) {
    next(error);
  }
}

export async function submitJobDescriptionController(req, res, next) {
  try {
    const request = await submitJobDescriptionService(req.params.id, req.body, req.user);
    return res.status(201).json({ success: true, message: "JD submitted for approval", data: request });
  } catch (error) {
    next(error);
  }
}

export async function approveJobDescriptionController(req, res, next) {
  try {
    const request = await decideJobDescriptionService(req.params.id, req.body, req.user, "APPROVED");
    return res.status(200).json({ success: true, message: "JD approval decision recorded", data: request });
  } catch (error) {
    next(error);
  }
}

export async function rejectJobDescriptionController(req, res, next) {
  try {
    const request = await decideJobDescriptionService(req.params.id, req.body, req.user, "REJECTED");
    return res.status(200).json({ success: true, message: "JD rejection recorded", data: request });
  } catch (error) {
    next(error);
  }
}

export async function getJobDescriptionApprovalHistoryController(req, res, next) {
  try {
    const history = await getJobDescriptionApprovalHistoryService(req.params.id, req.user);
    return res.status(200).json({ success: true, message: "JD approval history fetched successfully", data: history });
  } catch (error) {
    next(error);
  }
}

export async function publishJobDescriptionController(req, res, next) {
  try {
    const job = await publishJobDescriptionService(req.params.id, req.user);
    return res.status(200).json({ success: true, message: "JD published successfully", data: job });
  } catch (error) {
    next(error);
  }
}
