
import {
  createRequirementService,
  getRequirementsService,
  getRequirementService,
  updateRequirementService,
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
