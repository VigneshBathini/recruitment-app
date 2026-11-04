import pool from "../config/database.js";

export async function getAllRoles() {
  const [rows] = await pool.execute(
    `SELECT
       id,
       name,
       description
     FROM roles
     ORDER BY name ASC`
  );

  return rows;
}

export async function getRolesByOrganization(organizationId) {
  const [organizations] = await pool.execute(
    `SELECT id FROM organizations WHERE id = ? LIMIT 1`,
    [organizationId]
  );
  if (!organizations.length) return null;
  const [rows] = await pool.execute(
    `SELECT r.id, r.name, r.description,
       COALESCE(configured.permission_count, 0) AS permission_count
     FROM roles r
     INNER JOIN (
       SELECT role_id, COUNT(*) AS permission_count
       FROM organization_role_permissions
       WHERE organization_id = ?
       GROUP BY role_id
     ) configured ON configured.role_id = r.id
     ORDER BY r.name ASC`,
    [organizationId]
  );
  return rows;
}
