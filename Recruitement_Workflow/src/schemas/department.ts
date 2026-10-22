
import { z } from 'zod';

export const createDepartmentSchema = z.object({
  organization_id: z
    .number()
    .int()
    .positive('Please select an organization'),

  name: z
    .string()
    .trim()
    .min(2, 'Department name must be at least 2 characters')
    .max(150, 'Department name cannot exceed 150 characters'),

  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
});

export type CreateDepartmentInput = z.infer<
  typeof createDepartmentSchema
>;

export const updateDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Department name must be at least 2 characters')
    .max(150, 'Department name cannot exceed 150 characters'),

  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
});

export type UpdateDepartmentInput = z.infer<
  typeof updateDepartmentSchema
>;
