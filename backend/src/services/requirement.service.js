
import {
  createRequirement,
  getRequirementById,
  getRequirementsByOrganization,
  getAllRequirements,
  getRequirementByIdForPlatform,
  departmentBelongsToOrganization,
  updateRequirement,
  submitRequirement,
  getPendingRequirements,
  approveRequirement,
  rejectRequirement
} from "../repositories/requirement.repository.js";

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateRequirement(data) {
  if (!data.title || !data.title.trim()) {
    throw createError("Requirement title is required", 400);
  }

  if (data.title.trim().length > 200) {
    throw createError("Requirement title cannot exceed 200 characters", 400);
  }

  const openings = data.openings ?? 1;

  if (!Number.isInteger(openings) || openings < 1) {
    throw createError("Openings must be a positive integer", 400);
  }

  const minExperience = data.experience_min_years;
  const maxExperience = data.experience_max_years;

  if (
    minExperience != null &&
    (!Number.isFinite(Number(minExperience)) || Number(minExperience) < 0)
  ) {
    throw createError("Minimum experience must be a valid non-negative number", 400);
  }

  if (
    maxExperience != null &&
    (!Number.isFinite(Number(maxExperience)) || Number(maxExperience) < 0)
  ) {
    throw createError("Maximum experience must be a valid non-negative number", 400);
  }

  if (
    minExperience != null &&
    maxExperience != null &&
    Number(maxExperience) < Number(minExperience)
  ) {
    throw createError(
      "Maximum experience cannot be less than minimum experience",
      400
    );
  }
}

async function validateDepartment(departmentId, organizationId) {
  if (departmentId == null) return;

  const belongsToOrganization = await departmentBelongsToOrganization(
    departmentId,
    organizationId
  );

  if (!belongsToOrganization) {
    throw createError(
      "Department not found or does not belong to this organization",
      400
    );
  }
}

export async function createRequirementService(data, user) {
  validateRequirement(data);

  await validateDepartment(data.department_id, user.organization_id);

  return createRequirement({
    ...data,
    organization_id: user.organization_id,
    created_by: user.id,
  });
}

export async function getRequirementsService(user) {
  if (user.account_type === "platform_admin") return getAllRequirements();
  return getRequirementsByOrganization(user.organization_id);
}

export async function getRequirementService(id, user) {
  const requirement = user.account_type === "platform_admin"
    ? await getRequirementByIdForPlatform(id)
    : await getRequirementById(
    id,
    user.organization_id
  );

  if (!requirement) {
    throw createError("Requirement not found", 404);
  }

  return requirement;
}

export async function updateRequirementService(id, data, user) {
  validateRequirement(data);

  await validateDepartment(data.department_id, user.organization_id);

  const requirement = await updateRequirement(
    id,
    user.organization_id,
    data
  );

  if (!requirement) {
    throw createError(
      "Requirement not found or cannot be updated because it is not in DRAFT status",
      404
    );
  }

  return requirement;
}

export async function submitRequirementService(id, user) {
  const requirement = await submitRequirement(
    id,
    user.organization_id
  );

  if (!requirement) {
    throw createError(
      "Requirement not found or already submitted",
      400
    );
  }

  return requirement;
}

export async function getPendingRequirementsService(user) {
  return await getPendingRequirements(user.organization_id);
}

export async function approveRequirementService(id, user) {
  const requirement = await approveRequirement(
    id,
    user.organization_id,
    user.id
  );

  if (!requirement) {
    const error = new Error(
      "Requirement not found or not pending approval"
    );
    error.statusCode = 404;
    throw error;
  }

  return requirement;
}

export async function rejectRequirementService(
  id,
  user,
  rejectionReason
) {
  const requirement = await rejectRequirement(
    id,
    user.organization_id,
    user.id,
    rejectionReason
  );

  if (!requirement) {
    const error = new Error(
      "Requirement not found or not pending approval"
    );
    error.statusCode = 404;
    throw error;
  }

  return requirement;
}