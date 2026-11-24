const LOCAL_DEVELOPMENT_API = "http://localhost:5000/api";

export function resolveApiBaseUrl(configuredUrl, environment = process.env.NODE_ENV) {
  const isProduction = environment === "production";
  const value = typeof configuredUrl === "string" ? configuredUrl.trim() : "";

  if (!value) {
    if (isProduction) {
      throw new Error("EXPO_PUBLIC_API_URL must be configured with HTTPS for production builds");
    }
    return LOCAL_DEVELOPMENT_API;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("EXPO_PUBLIC_API_URL must be a valid absolute URL");
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("EXPO_PUBLIC_API_URL must use HTTP or HTTPS and must not contain credentials");
  }
  if (isProduction && parsed.protocol !== "https:") {
    throw new Error("EXPO_PUBLIC_API_URL must use HTTPS in production builds");
  }

  return value.replace(/\/+$/, "");
}

