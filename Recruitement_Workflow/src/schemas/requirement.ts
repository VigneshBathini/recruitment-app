import { z } from 'zod';

export const createRequirementSchema = z
  .object({
    department_id: z.number().int().positive('Select a department'),
    title: z
      .string()
      .trim()
      .min(2, 'Job title must be at least 2 characters')
      .max(200, 'Job title cannot exceed 200 characters'),
    openings: z
      .number()
      .int('Openings must be a whole number')
      .min(1, 'At least one opening is required'),
    experience_min_years: z
      .number()
      .min(0, 'Experience cannot be negative'),
    experience_max_years: z
      .number()
      .min(0, 'Experience cannot be negative'),
    location: z
      .string()
      .trim()
      .min(2, 'Location must be at least 2 characters')
      .max(150, 'Location cannot exceed 150 characters'),
    employment_type: z
      .string()
      .trim()
      .min(1, 'Select an employment type')
      .max(50, 'Employment type cannot exceed 50 characters'),
    description: z
      .string()
      .trim()
      .max(2000, 'Description cannot exceed 2,000 characters')
      .nullable(),
  })
  .superRefine((requirement, context) => {
    if (
      requirement.experience_max_years <
      requirement.experience_min_years
    ) {
      context.addIssue({
        code: 'custom',
        path: ['experience_max_years'],
        message: 'Maximum experience must be at least the minimum',
      });
    }
  });

export type CreateRequirementInput = z.infer<
  typeof createRequirementSchema
>;
