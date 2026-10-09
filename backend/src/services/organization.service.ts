import {
  createOrganization as createOrganizationRepository,
} from "../repositories/organization.repository";

import type { CreateOrganizationInput } from "../schemas/organization.schema";

export async function createOrganization(
  data: CreateOrganizationInput
) {
  const organizationData = {
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase(),
    email: data.email?.trim().toLowerCase(),
  };

  return createOrganizationRepository(organizationData);
}