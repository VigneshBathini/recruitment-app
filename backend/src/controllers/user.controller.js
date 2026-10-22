
import {
  createUserSchema,
  updateUserSchema,
} from "../schemas/user.schema.js";

import {
  createUser,
  getUsers,
  updateUserService,
  setUserStatusService,
} from "../services/user.service.js";

import { z } from "zod";

const userStatusSchema = z.object({
  is_active: z.boolean(),
});

export async function createUserController(req, res, next) {
  const validation = createUserSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.flatten(),
    });
  }

  try {
    // Always use the organization from the verified JWT.
    const organizationId = req.user.organization_id;

    // Never trust organization_id supplied by the frontend.
    const user = await createUser({
      ...validation.data,
      organization_id: organizationId,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "This email is already registered in the organization",
      });
    }

    if (
      error.message === "Organization not found" ||
      error.message === "Role not found" ||
      error.message ===
        "Department not found or does not belong to this organization"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
}

export async function getUsersController(req, res, next) {
  try {
    // Ignore the organization ID supplied in the URL.
    const organizationId = req.user.organization_id;

    const users = await getUsers(organizationId);

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    if (error.message === "Organization not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
}

export async function updateUserController(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const validation = updateUserSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    // Scope the update to the authenticated user's organization.
    const organizationId = req.user.organization_id;

    const user = await updateUserService(
      id,
      organizationId,
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to update user",
    });
  }
}

export async function updateUserStatusController(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const validation = userStatusSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "is_active must be true or false",
      });
    }

    // Scope activation/deactivation to the authenticated organization.
    const organizationId = req.user.organization_id;

    const user = await setUserStatusService(
      id,
      organizationId,
      validation.data.is_active
    );

    return res.status(200).json({
      success: true,
      message: user.is_active
        ? "User activated successfully"
        : "User deactivated successfully",
      data: user,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
}
