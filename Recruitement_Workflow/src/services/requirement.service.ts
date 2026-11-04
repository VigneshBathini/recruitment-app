
import api from "@/services/api";

export type RequirementStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

export type Requirement = {
  id: number;
  organization_id: number;
  department_id: number;
  department_name?: string | null;
  title: string;
  openings: number;
  experience_min_years: number;
  experience_max_years: number;
  location: string;
  employment_type: string;
  description: string | null;
  status: RequirementStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
  reviewed_by?: number | null;
  reviewer_name?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
};

export type RequirementInput = {
  department_id: number;
  title: string;
  openings: number;
  experience_min_years: number;
  experience_max_years: number;
  location: string;
  employment_type: string;
  description: string | null;
};

type RequirementResponse = {
  success: boolean;
  message?: string;
  data: Requirement;
};

type RequirementsResponse = {
  success: boolean;
  message?: string;
  data: Requirement[];
};

export async function getRequirements(): Promise<Requirement[]> {
  const response = await api.get<RequirementsResponse>(
    "/requirements",
  );

  return response.data.data;
}

export async function getRequirementById(
  id: number,
): Promise<Requirement> {
  const response = await api.get<RequirementResponse>(
    `/requirements/${id}`,
  );

  return response.data.data;
}

export async function createRequirement(
  input: RequirementInput,
): Promise<Requirement> {
  const response = await api.post<RequirementResponse>(
    "/requirements",
    input,
  );

  return response.data.data;
}

export async function updateRequirement(
  id: number,
  input: RequirementInput,
): Promise<Requirement> {
  const response = await api.put<RequirementResponse>(
    `/requirements/${id}`,
    input,
  );

  return response.data.data;
}

export async function submitRequirement(
  id: number,
): Promise<Requirement> {
  const response = await api.patch<RequirementResponse>(
    `/requirements/${id}/submit`,
  );

  return response.data.data;
}

export async function getPendingRequirements(): Promise<Requirement[]> {
  const response = await api.get<RequirementsResponse>(
    "/requirements/pending",
  );

  return response.data.data;
}

export async function approveRequirement(
  id: number,
): Promise<Requirement> {
  const response = await api.patch<RequirementResponse>(
    `/requirements/${id}/approve`,
  );

  return response.data.data;
}

export async function rejectRequirement(
  id: number,
  rejection_reason: string,
): Promise<Requirement> {
  const response = await api.patch<RequirementResponse>(
    `/requirements/${id}/reject`,
    { rejection_reason },
  );

  return response.data.data;
}
