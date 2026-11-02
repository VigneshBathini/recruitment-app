
import api from "@/services/api";

import type { CreateOrganizationInput } from "@/schemas/organization";
import { getAccountType, getOrganizationContext } from "@/services/token.service";
import { getCurrentOrganizationUser } from "@/services/auth.service";

export type Organization = {
  id: number;
  name: string;
  slug: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
};

type CreateOrganizationResponse = {
  success: true;
  message: string;
  data: Organization;
};

type GetOrganizationsResponse = {
  success: true;
  data: Organization[];
};

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<Organization> {
  const response = await api.post<CreateOrganizationResponse>(
    "/organizations",
    input,
  );

  return response.data.data;
}

export async function getOrganizations(): Promise<Organization[]> {
  const response = await api.get<GetOrganizationsResponse>(
    "/organizations",
  );

  return response.data.data;
}

export async function getManagedOrganizations(): Promise<Organization[]> {
  const accountType = await getAccountType();
  if (accountType === 'platform_admin') return getOrganizations();

  const organization = await getOrganizationContext() ?? await getCurrentOrganizationUser();
  return [{
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    email: null,
    is_active: true,
    created_at: '',
  }];
}

export async function updateOrganization(id: number, input: CreateOrganizationInput): Promise<Organization> {
  const response = await api.put<{ success: true; data: Organization }>(`/organizations/${id}`, input);
  return response.data.data;
}

export async function setOrganizationStatus(id: number, is_active: boolean): Promise<Organization> {
  const response = await api.patch<{ success: true; data: Organization }>(`/organizations/${id}/status`, { is_active });
  return response.data.data;
}
