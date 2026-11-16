import {
  createApprovalRequest,
  decideApprovalRequest,
  getApprovalRequest,
  getApprovalWorkflows,
} from "../repositories/approval.repository.js";
import { getPermissionsByRoleId } from "../repositories/permission.repository.js";

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

async function requireJobPermission(user, permissionNames) {
  const permissions = await getPermissionsByRoleId(user.organization_id, user.role_id);
  const requiredPermissions = Array.isArray(permissionNames) ? permissionNames : [permissionNames];
  if (!permissions.some((permission) => requiredPermissions.includes(permission.name))) {
    throw createError(`Missing required permission: ${requiredPermissions.join(" or ")}`, 403);
  }
}

export async function getApprovalWorkflowsService(entityType, user) {
  const normalizedEntityType = requiredEntityType(entityType);
  if (normalizedEntityType === "JOB") await requireJobPermission(user, "job.manage");
  return getApprovalWorkflows(user.organization_id, normalizedEntityType);
}

export async function submitApprovalRequestService(data, user) {
  const workflowId = requiredId(data.workflow_id, "workflow_id");
  const entityId = requiredId(data.entity_id, "entity_id");
  const entityType = requiredEntityType(data.entity_type);
  if (entityType === "JOB") await requireJobPermission(user, "job.manage");
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
  if (request.entity_type === "JOB") {
    await requireJobPermission(user, ["job.view", "job.manage", "job.approve"]);
  }
  return request;
}

export async function decideApprovalRequestService(id, data, user, decision) {
  const stepOrder = requiredId(data?.step_order, "step_order");
  if (data?.comments != null && typeof data.comments !== "string") {
    throw createError("comments must be a string", 400);
  }
  const comments = data?.comments == null ? null : data.comments.trim();
  if (comments && comments.length > 5000) throw createError("Comments cannot exceed 5000 characters", 400);
  const request = await getApprovalRequest(requiredId(id, "request id"), user.organization_id);
  if (!request) throw createError("Approval request not found", 404);
  if (request.entity_type === "JOB") await requireJobPermission(user, "job.approve");
  return decideApprovalRequest({
    requestId: request.id,
    organizationId: user.organization_id,
    userId: user.id,
    roleId: user.role_id,
    stepOrder,
    decision,
    comments,
  });
}
