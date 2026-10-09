import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Organization name must be at least 2 characters')
    .max(150, 'Organization name cannot exceed 150 characters'),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(150, 'Slug cannot exceed 150 characters')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Use lowercase letters, numbers, and hyphens only',
    ),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .max(255, 'Email cannot exceed 255 characters')
    .optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
