import {
  createOfferService,
  getOfferService,
  getOfferWorkflowsService,
  issueOfferService,
  listOffersService,
  submitOfferService,
  updateOfferService,
} from "../services/offer.service.js";

function sendError(error, res, next) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
}

export async function listOffersController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listOffersService(req.query, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function getOfferController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await getOfferService(req.params.id, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function createOfferController(req, res, next) {
  try { return res.status(201).json({ success: true, message: "Offer draft created", data: await createOfferService(req.body, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function updateOfferController(req, res, next) {
  try { return res.status(200).json({ success: true, message: "Offer draft updated", data: await updateOfferService(req.params.id, req.body, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function getOfferWorkflowsController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await getOfferWorkflowsService(req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function submitOfferController(req, res, next) {
  try { return res.status(201).json({ success: true, message: "Offer submitted for approval", data: await submitOfferService(req.params.id, req.body, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}

export async function issueOfferController(req, res, next) {
  try { return res.status(200).json({ success: true, message: "Offer issued", data: await issueOfferService(req.params.id, req.user) }); }
  catch (error) { return sendError(error, res, next); }
}
