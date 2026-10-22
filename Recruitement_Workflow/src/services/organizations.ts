
import api from "@/services/api";

import type { CreateOrganizationInput } from "@/schemas/organization";

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
