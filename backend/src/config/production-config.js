import { readFileSync } from "node:fs";
import { createSecureContext } from "node:tls";

const REQUIRED_DATABASE_SETTINGS = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];

export function validateProductionEnvironment(env = process.env, readFile = readFileSync) {
  if (env.NODE_ENV !== "production") return null;

  const missing = REQUIRED_DATABASE_SETTINGS.filter((key) => !env[key]?.trim());
  if (missing.length) {
    throw new Error(`Production configuration is missing required settings: ${missing.join(", ")}`);
  }
  if (!env.JWT_SECRET?.trim()) {
    throw new Error("Production configuration is missing required setting: JWT_SECRET");
  }

  const caPath = env.DB_TLS_CA_FILE?.trim();
  if (!caPath) {
    throw new Error("Production configuration is missing required setting: DB_TLS_CA_FILE");
  }

  let ca;
  try {
    ca = readFile(caPath, "utf8");
    if (!ca.includes("-----BEGIN CERTIFICATE-----")) throw new Error("Invalid CA certificate");
    createSecureContext({ ca });
  } catch {
    throw new Error("Production MySQL TLS CA configuration is invalid or unreadable");
  }

  return { ca, rejectUnauthorized: true };
}

export function createDatabaseConfig(env = process.env, validate = validateProductionEnvironment) {
  const tls = validate(env);
  const port = env.DB_PORT ? Number(env.DB_PORT) : 3306;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    if (env.NODE_ENV === "production") throw new Error("Production configuration has an invalid DB_PORT");
  }

  return {
    host: env.DB_HOST,
    port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ...(tls ? { ssl: tls } : {}),
  };
}
