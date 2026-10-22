
import pool from "../config/database.js";

export async function findUserByEmailAndOrganization(email, organizationSlug) {
  const [rows] = await pool.execute(
    `SELECT
        u.id,
        u.organization_id,
        u.role_id,
        u.department_id,
        u.first_name,
        u.last_name,
        u.email,
        u.password_hash,
        u.is_active,
        r.name AS role_name,
        o.slug AS organization_slug,
        o.is_active AS organization_is_active
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     INNER JOIN organizations o ON o.id = u.organization_id
     WHERE u.email = ?
       AND o.slug = ?
     LIMIT 1`,
    [email, organizationSlug]
  );

  return rows[0] ?? null;
}

export async function findUserById(id) {
  const [rows] = await pool.execute(
    `SELECT
        u.id,
        u.organization_id,
        u.role_id,
        u.department_id,
        u.first_name,
        u.last_name,
        u.email,
        u.is_active,
        o.is_active AS organization_is_active,
        r.name AS role_name
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     INNER JOIN organizations o ON o.id = u.organization_id
     WHERE u.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] ?? null;
}
