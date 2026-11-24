/** Restrict organization administration to the explicitly provisioned admin role. */
export function authorizeOrganizationAdmin(req, res, next) {
  if (req.user?.account_type !== "organization_user") {
    return res.status(403).json({
      success: false,
      message: "Organization Admin access is required",
    });
  }

  if (req.user.role_name !== "Organization Admin") {
    return res.status(403).json({
      success: false,
      message: "Only an Organization Admin can perform this action",
    });
  }

  return next();
}

// User management previously allowed Platform Admins to operate across tenants.
// Keep that platform boundary intact while requiring the organization role for
// organization-scoped callers.
export function authorizeUserManagement(req, res, next) {
  if (req.user?.account_type === "platform_admin") return next();
  return authorizeOrganizationAdmin(req, res, next);
}

export function preventOwnRolePermissionChange(req, res, next) {
  const targetRoleId = Number(req.params.roleId);
  if (Number.isSafeInteger(targetRoleId) && targetRoleId === req.user?.role_id) {
    return res.status(403).json({
      success: false,
      message: "You cannot modify permissions for your own role",
    });
  }
  return next();
}
