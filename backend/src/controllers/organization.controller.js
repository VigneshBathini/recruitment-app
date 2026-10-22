
import { createOrganizationSchema } from "../schemas/organization.schema.js";
import {
  createOrganization,
  getOrganizations,
} from "../services/organization.service.js";

export async function createOrganizationController(req, res) {
  const validation = createOrganizationSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.flatten(),
    });
  }

  try {
    const result = await createOrganization(validation.data);

    return res.status(201).json({
      success: true,
      message: "Organization created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Create organization failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create organization",
    });
  }
}

export async function getOrganizationsController(req, res, next) {
  try {
    const organizations = await getOrganizations();

    return res.status(200).json({
      success: true,
      data: organizations,
    });
  } catch (error) {
    next(error);
  }
}
