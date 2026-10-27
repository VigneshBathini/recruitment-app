
import { getPermissionsByRoleId } from "../repositories/permission.repository.js";

export function authorizePermission(requiredPermission) {
  return async function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
    }

    try {
      const permissions = await getPermissionsByRoleId(
        req.user.role_id
      );

      const hasPermission = permissions.some(
        (permission) => permission.name === requiredPermission
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Missing required permission: ${requiredPermission}`,
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
