
import jwt from "jsonwebtoken";
import { authenticateToken } from "./auth.middleware.js";
import { authenticatePlatformAdminToken } from "./platformAdminAuth.middleware.js";

// Authenticate organization users and Platform Admins
export function authenticateManagementToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is required",
    });
  }

  const decoded = jwt.decode(authorization.slice(7));

  if (
    decoded &&
    typeof decoded !== "string" &&
    decoded.account_type === "platform_admin"
  ) {
    return authenticatePlatformAdminToken(req, res, next);
  }

  return authenticateToken(req, res, () => {
    req.user.account_type = "organization_user";
    return next();
  });
}
