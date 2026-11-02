import { z } from 'zod';

const organizationFields = {
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
};

export const organizationSchema = z.object(organizationFields);
export const createOrganizationSchema = organizationSchema.extend({
  initial_admin: z.object({
    first_name: z.string().trim().min(1, 'First name is required').max(100),
    last_name: z.string().trim().max(100).optional(),
    email: z.string().trim().email('Enter a valid admin email').max(255),
    password: z.string().min(8, 'Password must contain at least 8 characters').max(128),
  }),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof organizationSchema>;
