
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from "../schemas/department.schema.js";

import * as departmentService from "../services/department.service.js";

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

    // Ensure the department belongs to the logged-in user's organization.
    if (
      Number(validation.data.organization_id) !==
      req.user.organization_id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot manage another organization's departments",
      });
    }

    const department = await departmentService.createDepartment(
      validation.data,
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
    const organizationId = Number(req.params.organizationId);

    if (!Number.isInteger(organizationId) || organizationId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid organization ID",
      });
    }

    // Ensure the user can only view their own organization's departments.
    if (organizationId !== req.user.organization_id) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot access another organization's departments",
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

    // The service must verify ownership before updating the department.
    const department = await departmentService.updateDepartment(
      id,
      validation.data,
      req.user.organization_id,
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
