import { authorizePermission } from "./authorizePermission.middleware.js";

export function authorizeManagementPermission(permission) {
  const authorizeOrganizationPermission = authorizePermission(permission);
  return (req, res, next) => {
    if (req.user?.account_type === "platform_admin") return next();
    return authorizeOrganizationPermission(req, res, next);
  };
}
