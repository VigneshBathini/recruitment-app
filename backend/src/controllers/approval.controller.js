import {
  decideApprovalRequestService,
  getApprovalRequestService,
  getApprovalWorkflowsService,
  submitApprovalRequestService,
} from "../services/approval.service.js";

export async function getApprovalWorkflowsController(req, res, next) {
  try {
    const workflows = await getApprovalWorkflowsService(req.query.entity_type, req.user);
    return res.status(200).json({ success: true, data: workflows });
  } catch (error) {
    next(error);
  }
}

export async function submitApprovalRequestController(req, res, next) {
  try {
    const request = await submitApprovalRequestService(req.body, req.user);
    return res.status(201).json({ success: true, message: "Approval request submitted", data: request });
  } catch (error) {
    next(error);
  }
}

export async function getApprovalRequestController(req, res, next) {
  try {
    const request = await getApprovalRequestService(req.params.id, req.user);
    return res.status(200).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
}

export async function approveRequestController(req, res, next) {
  try {
    const request = await decideApprovalRequestService(req.params.id, req.body, req.user, "APPROVED");
    return res.status(200).json({ success: true, message: "Approval decision recorded", data: request });
  } catch (error) {
    next(error);
  }
}

export async function rejectRequestController(req, res, next) {
  try {
    const request = await decideApprovalRequestService(req.params.id, req.body, req.user, "REJECTED");
    return res.status(200).json({ success: true, message: "Approval decision recorded", data: request });
  } catch (error) {
    next(error);
  }
}
