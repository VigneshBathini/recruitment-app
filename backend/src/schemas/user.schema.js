
import { z } from "zod";

export const createUserSchema = z.object({
  organization_id: z.number().int().positive(
    "Please select an organization"
  ),

  role_id: z.number().int().positive(
    "Please select a role"
  ),

  department_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),

  first_name: z
    .string()
    .trim()
    .min(2, "First name must be at least 2 characters")
    .max(100, "First name cannot exceed 100 characters"),

  last_name: z
    .string()
    .trim()
    .max(100, "Last name cannot exceed 100 characters")
    .nullable()
    .optional(),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email cannot exceed 255 characters"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password cannot exceed 72 characters"),
});



export const updateUserSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(2, "First name must be at least 2 characters")
    .max(100, "First name cannot exceed 100 characters"),

  last_name: z
    .string()
    .trim()
    .max(100, "Last name cannot exceed 100 characters")
    .nullable()
    .optional(),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email cannot exceed 255 characters"),

  role_id: z.number().int().positive("Please select a valid role"),

  department_id: z.number().int().positive().nullable(),
});
