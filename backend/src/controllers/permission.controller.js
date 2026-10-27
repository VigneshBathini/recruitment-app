
import {
  getPermissions,
  getRolePermissions,
  updateRolePermissions,
} from "../services/permission.service.js";

function parsePositiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function getPermissionsController(req, res, next) {
  try {
    const permissions = await getPermissions();

    return res.status(200).json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRolePermissionsController(req, res, next) {
  try {
    const roleId = parsePositiveId(req.params.roleId);

    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: "A valid role ID is required",
      });
    }

    const permissions = await getRolePermissions(roleId);

    return res.status(200).json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateRolePermissionsController(req, res, next) {
  try {
    const roleId = parsePositiveId(req.params.roleId);
    const { permissionIds } = req.body;

    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: "A valid role ID is required",
      });
    }

    if (
      !Array.isArray(permissionIds) ||
      !permissionIds.every(
        (id) => Number.isSafeInteger(id) && id > 0
      ) ||
      new Set(permissionIds).size !== permissionIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "permissionIds must be an array of unique positive integer IDs",
      });
    }

    const permissions = await updateRolePermissions(
      roleId,
      permissionIds
    );

    return res.status(200).json({
      success: true,
      message: "Role permissions updated successfully",
      data: permissions,
    });
  } catch (error) {
    next(error);
  }
}
