
import {
  createOrganization as createOrganizationRepository,
  getAllOrganizations
} from "../repositories/organization.repository.js";

export async function createOrganization(data) {
  const organizationData = {
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase(),
    email: data.email?.trim().toLowerCase(),
  };

  return createOrganizationRepository(organizationData);
}


export async function getOrganizations(){
    return await getAllOrganizations();
}