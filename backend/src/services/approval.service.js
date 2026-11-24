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
  return value.trim().toUpperCase();
}

async function requirePermission(user, permissionNames) {
  const permissions = await getPermissionsByRoleId(user.organization_id, user.role_id);
  const requiredPermissions = Array.isArray(permissionNames) ? permissionNames : [permissionNames];
  if (!permissions.some((permission) => requiredPermissions.includes(permission.name))) {
    throw createError(`Missing required permission: ${requiredPermissions.join(" or ")}`, 403);
  }
}

const entityPermissions = {
  JOB_REQUIREMENT: {
    workflow: "requirement.approve",
    submit: ["requirement.manage", "requirement.approve"],
    view: ["requirement.view", "requirement.manage", "requirement.approve"],
    decide: "requirement.approve",
  },
  JOB: { workflow: "job.manage", submit: "job.manage", view: ["job.view", "job.manage", "job.approve"], decide: "job.approve" },
  OFFER: { workflow: "offer.manage", submit: "offer.manage", view: ["offer.view", "offer.manage", "offer.approve"], decide: "offer.approve" },
};

function requireEntityPermission(entityType, action, user) {
  if (!Object.hasOwn(entityPermissions, entityType)) {
    throw createError(`Unsupported approval entity type: ${entityType}`, 400);
  }
  const permission = entityPermissions[entityType]?.[action];
  if (!permission) throw createError(`Unsupported approval action: ${action}`, 400);
  return requirePermission(user, permission);
}

export async function getApprovalWorkflowsService(entityType, user) {
  const normalizedEntityType = requiredEntityType(entityType);
  await requireEntityPermission(normalizedEntityType, "workflow", user);
  return getApprovalWorkflows(user.organization_id, normalizedEntityType);
}

export async function submitApprovalRequestService(data, user) {
  const workflowId = requiredId(data.workflow_id, "workflow_id");
  const entityId = requiredId(data.entity_id, "entity_id");
  const entityType = requiredEntityType(data.entity_type);
  await requireEntityPermission(entityType, "submit", user);
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
  await requireEntityPermission(request.entity_type, "view", user);
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
  await requireEntityPermission(request.entity_type, "decide", user);
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
