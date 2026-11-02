
import {
  createOrganization as createOrganizationRepository,
  getAllOrganizations,
  updateOrganization as updateOrganizationRepository,
  setOrganizationStatus as setOrganizationStatusRepository,
} from "../repositories/organization.repository.js";
import bcrypt from "bcryptjs";

export async function createOrganization(data) {
  const organizationData = {
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase(),
    email: data.email?.trim().toLowerCase(),
    initial_admin: {
      ...data.initial_admin,
      first_name: data.initial_admin.first_name.trim(),
      last_name: data.initial_admin.last_name?.trim() || null,
      email: data.initial_admin.email.trim().toLowerCase(),
      password_hash: await bcrypt.hash(data.initial_admin.password, 12),
    },
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
