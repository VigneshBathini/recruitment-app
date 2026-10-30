
import jwt from "jsonwebtoken";
import { findPlatformAdminById } from "../repositories/auth.repository.js";

export async function authenticatePlatformAdminToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is required",
    });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({
      success: false,
      message: "Authentication service is not configured",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(authorization.slice(7), secret);
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }

  if (
    typeof decoded === "string" ||
    decoded.account_type !== "platform_admin" ||
    !decoded.sub
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid Platform Admin token",
    });
  }

  const adminId = Number(decoded.sub);

  if (!Number.isSafeInteger(adminId) || adminId <= 0) {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }

  try {
    const admin = await findPlatformAdminById(adminId);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Platform Admin account no longer exists",
      });
    }

    if (Number(admin.is_active) !== 1) {
      return res.status(403).json({
        success: false,
        message: "Your Platform Admin account is inactive",
      });
    }

    req.user = {
      id: Number(admin.id),
      account_type: "platform_admin",
      role_name: "Platform Admin",
      first_name: admin.first_name,
      last_name: admin.last_name,
      email: admin.email,
    };

    return next();
  } catch (error) {
    console.error("Platform Admin session validation failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to validate your session",
    });
  }
}
