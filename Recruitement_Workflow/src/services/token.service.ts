
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "recruitment_access_token";

const ACCOUNT_TYPE_KEY = "recruitment_account_type";

export async function saveAccountType(
  accountType: "platform_admin" | "organization_user"
): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(ACCOUNT_TYPE_KEY, accountType);
    return;
  }

  await SecureStore.setItemAsync(ACCOUNT_TYPE_KEY, accountType);
}

export async function getAccountType(): Promise<
  "platform_admin" | "organization_user" | null
> {
  if (Platform.OS === "web") {
    return localStorage.getItem(ACCOUNT_TYPE_KEY) as
      | "platform_admin"
      | "organization_user"
      | null;
  }

  return (await SecureStore.getItemAsync(ACCOUNT_TYPE_KEY)) as
    | "platform_admin"
    | "organization_user"
    | null;
}

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage === "undefined") {
      throw new Error("Browser storage is unavailable");
    }

    localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof localStorage === "undefined") {
      return null;
    }

    return localStorage.getItem(TOKEN_KEY);
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
 if (Platform.OS === "web") {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACCOUNT_TYPE_KEY);
  return;
}

await SecureStore.deleteItemAsync(TOKEN_KEY);
await SecureStore.deleteItemAsync(ACCOUNT_TYPE_KEY);
}
