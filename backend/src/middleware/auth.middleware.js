
import jwt from "jsonwebtoken";
import { findUserById } from "../repositories/auth.repository.js";

export async function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is required",
    });
  }

  const token = authorization.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("JWT_SECRET is not configured");

    return res.status(500).json({
      success: false,
      message: "Authentication service is not configured",
    });
  }

  let decoded;

  // 1. Verify JWT signature and expiration.
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }

  if (
    typeof decoded === "string" ||
    !decoded.sub ||
    !decoded.organization_id
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }

  const userId = Number(decoded.sub);
  const tokenOrganizationId = Number(decoded.organization_id);

  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !Number.isSafeInteger(tokenOrganizationId) ||
    tokenOrganizationId <= 0
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }

  // 2. Verify the current user and organization in MySQL.
  try {
    const user = await findUserById(userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists",
      });
    }

    if (Number(user.is_active) !== 1) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    if (Number(user.organization_is_active) !== 1) {
      return res.status(403).json({
        success: false,
        message: "Your organization is inactive",
      });
    }

    // Prevent a token from being used with a different organization.
    if (Number(user.organization_id) !== tokenOrganizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication token does not match the user's organization",
      });
    }

    // 3. Use current database permissions, not stale JWT role details.
    req.user = {
      id: Number(user.id),
      organization_id: Number(user.organization_id),
      role_id: Number(user.role_id),
      role_name: user.role_name,
      department_id:
        user.department_id == null ? null : Number(user.department_id),
    };

    return next();
  } catch (error) {
    console.error("Session validation failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to validate your session",
    });
  }
}
