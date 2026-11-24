import {
  createOffer,
  getOfferApprovalHistory,
  getOfferById,
  issueOffer,
  listOffers,
  updateOffer,
} from "../repositories/offer.repository.js";
import { getApprovalWorkflowsService, submitApprovalRequestService } from "./approval.service.js";
import { parseOfferId, validateOfferSubmission, validateOfferTerms } from "../schemas/offer.schema.js";
import { getPermissionsByRoleId } from "../repositories/permission.repository.js";

function serviceError(message, statusCode) {
  const error = new Error(message); error.statusCode = statusCode; return error;
}

function dateOnly(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function effectiveStatus(offer) {
  const { effective_status: status, ...data } = offer;
  return { ...data, status: status ?? offer.status };
}

async function requirePermission(user, permission) {
  const permissions = await getPermissionsByRoleId(user.organization_id, user.role_id);
  if (!permissions.some((item) => item.name === permission)) throw serviceError(`Missing required permission: ${permission}`, 403);
}

function parseListQuery(query) {
  const search = query.search === undefined ? undefined : String(query.search).trim().slice(0, 150);
  const status = query.status === undefined ? undefined : String(query.status).trim().toUpperCase();
  if (status && !["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "ISSUED", "ACCEPTED", "DECLINED", "EXPIRED"].includes(status)) {
    throw serviceError("Unsupported offer status filter", 400);
  }
  return { search: search || undefined, status };
}

async function offerWithHistory(id, organizationId) {
  const storedOffer = await getOfferById(id, organizationId);
  if (!storedOffer) return null;
  const offer = effectiveStatus(storedOffer);
  offer.approval_history = await getOfferApprovalHistory(id, organizationId);
  offer.application = {
    id: Number(offer.application_id),
    status: offer.application_status,
    decision: offer.application_decision,
    current_stage: offer.current_stage,
  };
  offer.candidate = {
    id: Number(offer.candidate_id),
    first_name: offer.candidate_first_name,
    last_name: offer.candidate_last_name,
    email: offer.candidate_email,
  };
  offer.job = { id: Number(offer.job_id), title: offer.job_title };
  return offer;
}

export async function listOffersService(query, user) {
  const offers = await listOffers({ organizationId: user.organization_id, ...parseListQuery(query) });
  return offers.map(effectiveStatus);
}

export async function getOfferService(idValue, user) {
  const offer = await offerWithHistory(parseOfferId(idValue), user.organization_id);
  if (!offer) throw serviceError("Offer not found", 404);
  return offer;
}

export async function createOfferService(data, user) {
  const applicationId = parseOfferId(data?.application_id, "application_id");
  const terms = validateOfferTerms(data);
  const today = new Date().toISOString().slice(0, 10);
  if (terms.expiry_date && terms.expiry_date < today) throw serviceError("expiry_date must be today or later", 400);
  const id = await createOffer({ organizationId: user.organization_id, applicationId, createdBy: user.id, terms });
  return offerWithHistory(id, user.organization_id);
}

export async function updateOfferService(idValue, data, user) {
  const id = parseOfferId(idValue);
  const terms = validateOfferTerms(data, { partial: true });
  if (!Object.keys(terms).length) throw serviceError("At least one offer term must be provided", 400);
  const existing = await getOfferById(id, user.organization_id);
  if (!existing) throw serviceError("Offer not found", 404);
  const merged = validateOfferTerms({
    ...existing,
    start_date: dateOnly(existing.start_date),
    expiry_date: dateOnly(existing.expiry_date),
    ...terms,
  });
  const today = new Date().toISOString().slice(0, 10);
  if (merged.expiry_date && merged.expiry_date < today) throw serviceError("expiry_date must be today or later", 400);
  const updated = await updateOffer(id, user.organization_id, merged);
  if (!updated) throw serviceError("Offer not found", 404);
  return offerWithHistory(id, user.organization_id);
}

export async function getOfferWorkflowsService(user) {
  await requirePermission(user, "offer.manage");
  return getApprovalWorkflowsService("OFFER", user);
}

export async function submitOfferService(idValue, data, user) {
  await requirePermission(user, "offer.manage");
  const id = parseOfferId(idValue);
  const submission = validateOfferSubmission(data);
  const offer = await getOfferById(id, user.organization_id);
  if (!offer) throw serviceError("Offer not found", 404);
  if (!["DRAFT", "REJECTED"].includes(offer.status)) throw serviceError("Offer cannot be submitted from its current status", 409);
  const expiryDate = dateOnly(offer.expiry_date);
  if (expiryDate && expiryDate < new Date().toISOString().slice(0, 10)) throw serviceError("Expired offers cannot be submitted", 409);
  const workflows = await getApprovalWorkflowsService("OFFER", user);
  if (!workflows.length) throw serviceError("No active OFFER approval workflow is configured for this organization", 409);
  if (!workflows.some((workflow) => Number(workflow.id) === submission.workflow_id)) {
    throw serviceError("The selected OFFER approval workflow is not active for this organization", 409);
  }
  const approvalRequest = await submitApprovalRequestService({ workflow_id: submission.workflow_id, entity_type: "OFFER", entity_id: id }, user);
  return { offer: await offerWithHistory(id, user.organization_id), approval_request: approvalRequest };
}

export async function issueOfferService(idValue, user) {
  await requirePermission(user, "offer.issue");
  const id = parseOfferId(idValue);
  const offer = await issueOffer(id, user.organization_id, user.id);
  if (!offer) throw serviceError("Offer not found", 404);
  return offerWithHistory(id, user.organization_id);
}
