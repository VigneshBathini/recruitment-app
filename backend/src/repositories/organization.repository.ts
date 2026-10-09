import pool from "../config/database";
import type { CreateOrganizationInput } from "../schemas/organization.schema";

export async function createOrganization(
  data: CreateOrganizationInput
) {
  const [result] = await pool.execute(
    `INSERT INTO organizations (name, slug, email)
     VALUES (?, ?, ?)`,
    [data.name, data.slug, data.email ?? null]
  );

  const insertId = (result as { insertId: number }).insertId;

  const [rows] = await pool.execute(
    `SELECT id, name, slug, email, is_active, created_at
     FROM organizations
     WHERE id = ?`,
    [insertId]
  );

  const organizations = rows as Record<string, unknown>[];

  return organizations[0];
}