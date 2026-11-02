
import { createOrganizationSchema, updateOrganizationSchema } from "../schemas/organization.schema.js";
import {
  createOrganization,
  getOrganizations,
  updateOrganization,
  setOrganizationStatus,
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

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Organization name or slug, or admin email, is already in use" });
    }
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });

    return res.status(500).json({
      success: false,
      message: "Failed to create organization and initial admin",
    });
  }
}

export async function updateOrganizationController(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid organization ID" });
  }
  const validation = updateOrganizationSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, message: "Validation failed", errors: validation.error.flatten() });
  }
  try {
    const organization = await updateOrganization(id, validation.data);
    if (!organization) return res.status(404).json({ success: false, message: "Organization not found" });
    return res.json({ success: true, data: organization });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ success: false, message: "Organization name or slug is already in use" });
    return next(error);
  }
}

export async function updateOrganizationStatusController(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || typeof req.body?.is_active !== "boolean") {
    return res.status(400).json({ success: false, message: "Valid organization ID and is_active value are required" });
  }
  try {
    const organization = await setOrganizationStatus(id, req.body.is_active);
    if (!organization) return res.status(404).json({ success: false, message: "Organization not found" });
    return res.json({ success: true, data: organization });
  } catch (error) { return next(error); }
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
