
import {
  getPermissionsByRoleId,
} from "../repositories/permission.repository.js";

export function authorizePermission(requiredPermission) {
  const requiredPermissions = Array.isArray(requiredPermission)
    ? requiredPermission
    : [requiredPermission];
  return async function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
    }

    const organizationId = req.user.organization_id;
    const roleId = req.user.role_id;

    if (!organizationId || !roleId) {
      return res.status(403).json({
        success: false,
        message: "Organization or role context is missing",
      });
    }

    try {
      const permissions = await getPermissionsByRoleId(
        organizationId,
        roleId
      );

      const hasPermission = permissions.some(
        (permission) =>
          requiredPermissions.includes(permission.name)
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Missing required permission: ${requiredPermissions.join(" or ")}`,
        });
      }

      return next();
    } catch (error) {
      console.error("Permission authorization failed:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to verify permissions",
      });
    }
  };
}
