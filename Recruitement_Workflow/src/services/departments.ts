
import api from "@/services/api";

import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "@/schemas/department";

export type Department = {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
};

type DepartmentResponse = {
  success: boolean;
  message?: string;
  data: Department;
};

type DepartmentsResponse = {
  success: boolean;
  data: Department[];
};

export async function getDepartments(
  organizationId: number,
): Promise<Department[]> {
  const response = await api.get<DepartmentsResponse>(
    `/departments/${organizationId}`,
  );

  return response.data.data;
}

export async function createDepartment(
  input: CreateDepartmentInput,
): Promise<Department> {
  const response = await api.post<DepartmentResponse>(
    "/departments",
    input,
  );

  return response.data.data;
}

export async function updateDepartment(
  id: number,
  input: UpdateDepartmentInput,
): Promise<Department> {
  const response = await api.put<DepartmentResponse>(
    `/departments/${id}`,
    input,
  );

  return response.data.data;
}
