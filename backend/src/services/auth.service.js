
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  findUserByEmailAndOrganization,
} from "../repositories/auth.repository.js";

export async function loginService({
  organization_slug,
  email,
  password,
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedSlug = organization_slug.trim().toLowerCase();

  const user = await findUserByEmailAndOrganization(
    normalizedEmail,
    normalizedSlug
  );

  if (!user || Number(user.is_active) !== 1) {
    const error = new Error("Invalid organization, email, or password");
    error.statusCode = 401;
    throw error;
  }

  if (Number(user.organization_is_active) !== 1) {
    const error = new Error("This organization is inactive");
    error.statusCode = 403;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordMatches) {
    const error = new Error("Invalid organization, email, or password");
    error.statusCode = 401;
    throw error;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    const error = new Error("JWT_SECRET is not configured");
    error.statusCode = 500;
    throw error;
  }

  const token = jwt.sign(
    {
      sub: String(user.id),
      organization_id: Number(user.organization_id),
      role_id: Number(user.role_id),
      role_name: user.role_name,
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    }
  );

  return {
    token,
    user: {
      id: Number(user.id),
      organization_id: Number(user.organization_id),
      organization_slug: user.organization_slug,
      role_id: Number(user.role_id),
      role_name: user.role_name,
      department_id:
        user.department_id == null ? null : Number(user.department_id),
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
    },
  };
}
