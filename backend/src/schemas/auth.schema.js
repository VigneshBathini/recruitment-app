
import { z } from "zod";

export const loginSchema = z.object({
  organization_slug: z
    .string()
    .trim()
    .min(1, "Organization is required")
    .max(150, "Organization identifier is too long")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Enter a valid organization slug"
    ),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email cannot exceed 255 characters"),

  password: z
    .string()
    .min(1, "Password is required")
    .max(72, "Password cannot exceed 72 characters"),
});
