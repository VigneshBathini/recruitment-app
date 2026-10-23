import pool from "../config/database.js";

export async function createUser(data) {
  const [result] = await pool.execute(
    `INSERT INTO users
      (
        organization_id,
        role_id,
        department_id,
        first_name,
        last_name,
        email,
        password_hash
      )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.organization_id,
      data.role_id,
      data.department_id ?? null,
      data.first_name,
      data.last_name ?? null,
      data.email,
      data.password_hash,
    ]
  );

  return getUserById(result.insertId);
}

export async function getUserById(id) {
  const [rows] = await pool.execute(
    `SELECT
       u.id,
       u.organization_id,
       u.role_id,
       r.name AS role_name,
       u.department_id,
       d.name AS department_name,
       u.first_name,
       u.last_name,
       u.email,
       u.is_active,
       u.created_at,
       u.updated_at
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] ?? null;
}

export async function getUsersByOrganization(organizationId) {
  const [rows] = await pool.execute(
    `SELECT
       u.id,
       u.organization_id,
       u.role_id,
       r.name AS role_name,
       u.department_id,
       d.name AS department_name,
       u.first_name,
       u.last_name,
       u.email,
       u.is_active,
       u.created_at,
       u.updated_at
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.organization_id = ?
     ORDER BY u.created_at DESC`,
    [organizationId]
  );

  return rows;
}


export async function organizationExists(organizationId) {
  const [rows] = await pool.execute(
    `SELECT id
     FROM organizations
     WHERE id = ?
     LIMIT 1`,
    [organizationId]
  );

  return rows.length > 0;
}

export async function roleExists(roleId) {
  const [rows] = await pool.execute(
    `SELECT id
     FROM roles
     WHERE id = ?
     LIMIT 1`,
    [roleId]
  );

  return rows.length > 0;
}

export async function departmentBelongsToOrganization(
  departmentId,
  organizationId
) {
  const [rows] = await pool.execute(
    `SELECT id
     FROM departments
     WHERE id = ?
       AND organization_id = ?
       AND is_active = 1
     LIMIT 1`,
    [departmentId, organizationId]
  );

  return rows.length > 0;
}


export async function updateUser(id, organizationId, data) {
  await pool.execute(
    `UPDATE users
     SET first_name = ?,
         last_name = ?,
         email = ?,
         role_id = ?,
         department_id = ?
     WHERE id = ?
       AND organization_id = ?`,
    [
      data.first_name,
      data.last_name ?? null,
      data.email,
      data.role_id,
      data.department_id,
      id,
      organizationId,
    ]
  );

  const [rows] = await pool.execute(
    `SELECT id
     FROM users
     WHERE id = ? AND organization_id = ?
     LIMIT 1`,
    [id, organizationId]
  );

  if (rows.length === 0) {
    return null;
  }

  return getUserById(id);
}





export async function setUserStatus(id, organizationId, isActive) {
  await pool.execute(
    `UPDATE users
     SET is_active = ?
     WHERE id = ? AND organization_id = ?`,
    [isActive ? 1 : 0, id, organizationId]
  );

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
       r.name AS role_name,
       d.name AS department_name
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = ? AND u.organization_id = ?
     LIMIT 1`,
    [id, organizationId]
  );

  return rows[0] ?? null;
}


export async function getRoleById(roleId) {
  const [rows] = await pool.execute(
    `SELECT id, name
     FROM roles
     WHERE id = ?
     LIMIT 1`,
    [roleId]
  );

  return rows[0] ?? null;
}