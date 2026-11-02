import jwt from "jsonwebtoken";
import { authenticateToken } from "./auth.middleware.js";
import { authenticatePlatformAdminToken } from "./platformAdminAuth.middleware.js";

// Dispatch to the existing account-specific validator. The decoded token is
// only used to choose a validator; each validator verifies signature/status.
export function authenticateManagementToken(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication token is required" });
  }

  const decoded = jwt.decode(authorization.slice(7));
  if (decoded && typeof decoded !== "string" && decoded.account_type === "platform_admin") {
    return authenticatePlatformAdminToken(req, res, next);
  }

  return authenticateToken(req, res, () => {
    req.user.account_type = "organization_user";
    if (req.user.role_name !== "Organization Admin") {
      return res.status(403).json({ success: false, message: "Organization Admin access is required" });
    }
    return next();
  });
}
