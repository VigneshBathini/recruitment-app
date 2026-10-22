
import { z } from "zod";

export const createDepartmentSchema = z.object({
  organization_id: z.coerce
    .number()
    .int()
    .positive("Please select a valid organization"),

  name: z
    .string()
    .trim()
    .min(2, "Department name must be at least 2 characters")
    .max(150, "Department name cannot exceed 150 characters"),

  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .transform((value) => value || undefined),
});

export const updateDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Department name must be at least 2 characters")
    .max(150, "Department name cannot exceed 150 characters"),

  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .transform((value) => value || undefined),
});
