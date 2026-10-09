import axios from 'axios';

import type { CreateOrganizationInput } from '@/schemas/organization';

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000/api'
).replace(/\/+$/, '');

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

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<Organization> {
  const response = await axios.post<CreateOrganizationResponse>(
    `${API_BASE_URL}/organizations`,
    input,
  );

  return response.data.data;
}
