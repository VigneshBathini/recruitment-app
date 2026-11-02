
import {
  createOrganization as createOrganizationRepository,
  getAllOrganizations,
  updateOrganization as updateOrganizationRepository,
  setOrganizationStatus as setOrganizationStatusRepository,
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

export async function updateOrganization(id, data) {
  return updateOrganizationRepository(id, {
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase(),
    email: data.email?.trim().toLowerCase(),
  });
}

export async function setOrganizationStatus(id, isActive) {
  return setOrganizationStatusRepository(id, isActive);
}
