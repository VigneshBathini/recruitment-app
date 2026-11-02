import { authorizePermission } from "./authorizePermission.middleware.js";

export function authorizeManagementPermission(permission) {
  const authorizeOrganizationPermission = authorizePermission(permission);
  return (req, res, next) => {
    if (req.user?.account_type === "platform_admin") {
      if (req.method === "GET") return next();
      return res.status(403).json({ success: false, message: "Platform Admin requirement access is read-only" });
    }
    return authorizeOrganizationPermission(req, res, next);
  };
}
