
import api from "@/services/api";
import { removeToken } from "@/services/token.service";

export type LoginInput = {
  organization_slug: string;
  email: string;
  password: string;
};

export type AuthUser = {
  id: number;
  organization_id: number;
  organization_slug: string;
  role_id: number;
  role_name: string;
  department_id: number | null;
  first_name: string;
  last_name: string | null;
  email: string;
};

type LoginResponse = {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: AuthUser;
  };
};

export async function loginUser(
  input: LoginInput
): Promise<LoginResponse["data"]> {
  const response = await api.post<LoginResponse>(
    "/auth/login",
    input
  );

  return response.data.data;
}

export async function logoutUser(): Promise<void> {
  await removeToken();
}
