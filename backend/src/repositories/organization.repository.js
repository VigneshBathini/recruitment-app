
import pool from "../config/database.js";

export async function createOrganization(data) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO organizations (name, slug, email) VALUES (?, ?, ?)`,
      [data.name, data.slug, data.email ?? null]
    );
    const organizationId = result.insertId;
    await connection.execute(
      `INSERT INTO organization_roles (organization_id, role_id)
      SELECT ?, id FROM roles`,
      [organizationId]
    );

   await connection.execute(
  `INSERT INTO organization_permissions (organization_id, permission_id)
   SELECT ?, id FROM permissions`,
  [organizationId]
);
    const [roles] = await connection.execute(
      `SELECT id FROM roles WHERE name = 'Organization Admin' LIMIT 1`
    );
    if (!roles.length) throw Object.assign(new Error("Organization Admin role is not configured"), { statusCode: 500 });
    const roleId = roles[0].id;
    const admin = data.initial_admin;
    const [userResult] = await connection.execute(
      `INSERT INTO users (organization_id, role_id, department_id, first_name, last_name, email, password_hash)
       VALUES (?, ?, NULL, ?, ?, ?, ?)`,
      [organizationId, roleId, admin.first_name, admin.last_name, admin.email, admin.password_hash]
    );
    await connection.execute(
      `INSERT INTO organization_role_permissions (organization_id, role_id, permission_id)
       SELECT ?, ?, id FROM permissions`,
      [organizationId, roleId]
    );
    const [rows] = await connection.execute(
      `SELECT id, name, slug, email, is_active, created_at FROM organizations WHERE id = ?`,
      [organizationId]
    );
    await connection.commit();
    return { ...rows[0], initial_admin: { id: userResult.insertId, email: admin.email } };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}


export async function getAllOrganizations() {
  const [rows] = await pool.execute(
    `Select id,name,slug, email, is_active, created_at
         from organizations
         Order by created_at desc`
  )

  return rows;
}

export async function updateOrganization(id, data) {
  await pool.execute(
    `UPDATE organizations SET name = ?, slug = ?, email = ? WHERE id = ?`,
    [data.name, data.slug, data.email ?? null, id]
  );
  const [rows] = await pool.execute(
    `SELECT id, name, slug, email, is_active, created_at FROM organizations WHERE id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

export async function setOrganizationStatus(id, isActive) {
  const [result] = await pool.execute(
    `UPDATE organizations SET is_active = ? WHERE id = ?`,
    [isActive ? 1 : 0, id]
  );
  if (!result.affectedRows) return null;
  const [rows] = await pool.execute(
    `SELECT id, name, slug, email, is_active, created_at FROM organizations WHERE id = ?`,
    [id]
  );
  return rows[0] ?? null;
}
