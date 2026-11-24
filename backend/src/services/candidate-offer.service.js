import {
  getCandidateOffer,
  listCandidateOffers,
  respondToCandidateOffer,
} from "../repositories/candidate-offer.repository.js";

function serviceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseOfferId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw serviceError("Invalid offer ID", 400);
  return id;
}

function candidateScope(candidate) {
  return { candidateId: candidate.id, organizationId: candidate.organization_id };
}

export async function listMyOffersService(candidate) {
  const { candidateId, organizationId } = candidateScope(candidate);
  return listCandidateOffers(candidateId, organizationId);
}

export async function getMyOfferService(idValue, candidate) {
  const { candidateId, organizationId } = candidateScope(candidate);
  const offer = await getCandidateOffer(parseOfferId(idValue), candidateId, organizationId);
  if (!offer) throw serviceError("Offer not found", 404);
  return offer;
}

export async function respondToMyOfferService(idValue, candidate, status, comments) {
  const { candidateId, organizationId } = candidateScope(candidate);
  const result = await respondToCandidateOffer(
    parseOfferId(idValue), candidateId, organizationId, status, comments || null,
  );
  if (result.error === "not_found") throw serviceError("Offer not found", 404);
  if (result.error === "already_responded") {
    throw serviceError("Only an issued offer without a prior response can be answered", 409);
  }
  if (result.error === "expired") {
    throw serviceError("The offer response deadline has passed", 409);
  }
  if (result.error === "application_withdrawn") {
    throw serviceError("This application has been withdrawn, so the offer can no longer be answered", 409);
  }
  return result.offer;
}
