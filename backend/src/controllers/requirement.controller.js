
import {
  createRequirementService,
  getRequirementsService,
  getRequirementService,
  updateRequirementService,
  submitRequirementService,
  getPendingRequirementsService,
  approveRequirementService,
  rejectRequirementService
} from "../services/requirement.service.js";

export async function createRequirementController(req, res, next) {
  try {
    const requirement = await createRequirementService(
      req.body,
      req.user
    );

    return res.status(201).json({
      success: true,
      message: "Requirement created successfully",
      data: requirement,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRequirementsController(req, res, next) {
  try {
    const requirements = await getRequirementsService(req.user);

    return res.status(200).json({
      success: true,
      message: "Requirements fetched successfully",
      data: requirements,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRequirementController(req, res, next) {
  try {
    const requirement = await getRequirementService(
      req.params.id,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Requirement fetched successfully",
      data: requirement,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateRequirementController(req, res, next) {
  try {
    const requirement = await updateRequirementService(
      req.params.id,
      req.body,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Requirement updated successfully",
      data: requirement,
    });
  } catch (error) {
    next(error);
  }
}


export async function submitRequirementController(req,res,next){
  try{
    const requirement = await submitRequirementService(
      req.params.id,
      req.user
    )

      return res.status(200).json({
      success: true,
      message: "Requirement submitted for approval successfully",
      data: requirement,
    });
  }
  catch(error){
     next(error);
  }
}

export async function getPendingRequirementsController(req, res, next) {
  try {
    const requirements = await getPendingRequirementsService(req.user);

    return res.status(200).json({
      success: true,
      message: "Pending requirements fetched successfully",
      data: requirements,
    });
  } catch (error) {
    next(error);
  }
}

export async function approveRequirementController(req, res, next) {
  try {
    const requirement = await approveRequirementService(
      req.params.id,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Requirement approved successfully",
      data: requirement,
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectRequirementController(req, res, next) {
  try {
    const rejectionReason = req.body.rejection_reason;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const requirement = await rejectRequirementService(
      req.params.id,
      req.user,
      rejectionReason.trim()
    );

    return res.status(200).json({
      success: true,
      message: "Requirement rejected successfully",
      data: requirement,
    });
  } catch (error) {
    next(error);
  }
}