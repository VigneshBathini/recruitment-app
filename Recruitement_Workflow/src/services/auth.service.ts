
import api from "@/services/api";
import { removeToken, saveOrganizationContext, type OrganizationContext } from "@/services/token.service";

export type LoginInput = {
  organization_slug: string;
  email: string;
  password: string;
};

export type AuthUser = {
  id: number;
  account_type: "platform_admin" | "organization_user";
  organization_id?: number;
  organization_slug?: string;
  organization_name?: string;
  role_id?: number;
  role_name: string;
  department_id?: number | null;
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

export async function getCurrentOrganizationUser(): Promise<OrganizationContext> {
  const response = await api.get<{ success: boolean; data: { user: AuthUser } }>("/auth/me");
  const user = response.data.data.user;
  if (!user.organization_id || !user.organization_slug) {
    throw new Error("Organization account details are missing.");
  }
  const context: OrganizationContext = {
    id: user.organization_id,
    name: user.organization_name ?? user.organization_slug,
    slug: user.organization_slug,
    role_name: user.role_name,
  };
  await saveOrganizationContext(context);
  return context;
}

export async function logoutUser(): Promise<void> {
  await removeToken();
}
