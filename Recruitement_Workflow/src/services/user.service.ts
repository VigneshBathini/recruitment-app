
import api from "@/services/api";

export type User = {
  id: number;
  organization_id: number;
  role_id: number;
  role_name: string;
  department_id: number | null;
  department_name: string | null;
  first_name: string;
  last_name: string | null;
  email: string;
  is_active: number;
};

export type CreateUserInput = {
  organization_id: number;
  role_id: number;
  department_id: number | null;
  first_name: string;
  last_name: string | null;
  email: string;
  password: string;
};

export type UpdateUserInput = {
  first_name: string;
  last_name?: string | null;
  email: string;
  role_id: number;
  department_id: number | null;
};

type UserResponse = {
  success: boolean;
  message?: string;
  data: User;
};

type UsersResponse = {
  success: boolean;
  message?: string;
  data: User[];
};

export async function getUsers(
  organizationId: number,
): Promise<User[]> {
  const response = await api.get<UsersResponse>(
    `/users/organization/${organizationId}`,
  );

  return response.data.data;
}

export async function createUser(
  input: CreateUserInput,
): Promise<User> {
  const response = await api.post<UserResponse>(
    "/users",
    input,
  );

  return response.data.data;
}

export async function updateUser(
  id: number,
  input: UpdateUserInput,
): Promise<User> {
  const response = await api.put<UserResponse>(
    `/users/${id}`,
    input,
  );

  return response.data.data;
}

export async function updateUserStatus(
  id: number,
  isActive: boolean,
): Promise<User> {
  const response = await api.patch<UserResponse>(
    `/users/${id}/status`,
    {
      is_active: isActive,
    },
  );

  return response.data.data;
}
