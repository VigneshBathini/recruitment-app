import {
  createApprovalRequest,
  decideApprovalRequest,
  getApprovalRequest,
  getApprovalWorkflows,
} from "../repositories/approval.repository.js";

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requiredId(value, field) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError(`${field} must be a positive integer`, 400);
  }
  return id;
}

function requiredEntityType(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 50) {
    throw createError("entity_type is required and must be at most 50 characters", 400);
  }
  return value.trim();
}

export async function getApprovalWorkflowsService(entityType, user) {
  return getApprovalWorkflows(user.organization_id, requiredEntityType(entityType));
}

export async function submitApprovalRequestService(data, user) {
  const workflowId = requiredId(data.workflow_id, "workflow_id");
  const entityId = requiredId(data.entity_id, "entity_id");
  const entityType = requiredEntityType(data.entity_type);
  return createApprovalRequest({
    organizationId: user.organization_id,
    workflowId,
    entityType,
    entityId,
    requestedBy: user.id,
  });
}

export async function getApprovalRequestService(id, user) {
  const request = await getApprovalRequest(requiredId(id, "request id"), user.organization_id);
  if (!request) throw createError("Approval request not found", 404);
  return request;
}

export async function decideApprovalRequestService(id, data, user, decision) {
  const stepOrder = requiredId(data?.step_order, "step_order");
  if (data?.comments != null && typeof data.comments !== "string") {
    throw createError("comments must be a string", 400);
  }
  const comments = data?.comments == null ? null : data.comments.trim();
  if (comments && comments.length > 5000) throw createError("Comments cannot exceed 5000 characters", 400);
  return decideApprovalRequest({
    requestId: requiredId(id, "request id"),
    organizationId: user.organization_id,
    userId: user.id,
    roleId: user.role_id,
    stepOrder,
    decision,
    comments,
  });
}
