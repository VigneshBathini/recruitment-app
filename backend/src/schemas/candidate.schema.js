import { z } from "zod";

const organizationSlug = z
  .string()
  .trim()
  .min(2)
  .max(150)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Enter a valid organization slug");

const email = z.string().trim().email().max(255).transform((value) => value.toLowerCase());

export const candidateRegistrationSchema = z.object({
  organization_slug: organizationSlug,
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().max(100).optional().nullable(),
  email,
  password: z.string().min(8).max(72),
});

export const candidateLoginSchema = z.object({
  organization_slug: organizationSlug,
  email,
  password: z.string().min(1).max(72),
});

export const candidateProfileUpdateSchema = z.object({
  first_name: z.string().trim().min(1).max(100).optional(),
  last_name: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
}).strict().refine(
  (data) => Object.keys(data).length > 0,
  "Provide at least one profile field to update"
);

export const candidateApplicationSchema = z.object({
  job_id: z.coerce.number().int().positive().safe(),
});
