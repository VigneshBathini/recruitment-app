
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from "../schemas/department.schema.js";

import * as departmentService from "../services/department.service.js";

function getRequestedOrganizationId(req, value) {
  if (req.user.account_type === "organization_user") {
    if (value != null && Number(value) !== req.user.organization_id) return null;
    return req.user.organization_id;
  }
  const organizationId = Number(value);
  return Number.isSafeInteger(organizationId) && organizationId > 0
    ? organizationId
    : null;
}

export async function createDepartmentController(req, res, next) {
  try {
    const validation = createDepartmentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const organizationId = getRequestedOrganizationId(req, validation.data.organization_id);
    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "A valid organization scope is required",
      });
    }

    const department = await departmentService.createDepartment(
      { ...validation.data, organization_id: organizationId },
    );

    return res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: department,
    });
  } catch (error) {
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({
        success: false,
        message: "The selected organization does not exist",
      });
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "This department already exists for the organization",
      });
    }

    return next(error);
  }
}

export async function getDepartmentsController(req, res, next) {
  try {
    const requestedId = Number(req.params.organizationId);
    if (!Number.isSafeInteger(requestedId) || requestedId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid organization ID" });
    }
    if (req.user.account_type === "organization_user" && requestedId !== req.user.organization_id) {
      return res.status(403).json({ success: false, message: "You cannot access another organization's departments" });
    }
    const organizationId = getRequestedOrganizationId(req, requestedId);

    if (!organizationId) {
      return res.status(req.user.account_type === "organization_user" ? 403 : 400).json({
        success: false,
        message: "Invalid organization scope",
      });
    }

    const departments =
      await departmentService.getDepartmentsByOrganization(
        organizationId,
      );

    return res.status(200).json({
      success: true,
      data: departments,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateDepartmentController(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid department ID",
      });
    }

    const validation = updateDepartmentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const organizationId = getRequestedOrganizationId(req, req.query.organizationId);
    if (!organizationId) {
      return res.status(req.user.account_type === "organization_user" ? 403 : 400).json({ success: false, message: "A valid organization scope is required" });
    }

    const department = await departmentService.updateDepartment(
      id,
      validation.data,
      organizationId,
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  } catch (error) {
    console.error("Update department error:", error);

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({
        success: false,
        message: "The selected organization does not exist",
      });
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "This department already exists for the organization",
      });
    }

    return next(error);
  }
}
