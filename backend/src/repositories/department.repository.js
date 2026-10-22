
import pool from "../config/database.js";

export async function createDepartment(data) {
  const [result] = await pool.execute(
    `INSERT INTO departments
      (organization_id, name, description)
     VALUES (?, ?, ?)`,
    [
      data.organization_id,
      data.name,
      data.description ?? null,
    ],
  );

  return getDepartmentById(result.insertId);
}

export async function getDepartmentById(id) {
  const [rows] = await pool.execute(
    `SELECT id, organization_id, name, description
     FROM departments
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ?? null;
}

export async function getDepartmentsByOrganization(
  organizationId,
) {
  const [rows] = await pool.execute(
    `SELECT id, organization_id, name, description
     FROM departments
     WHERE organization_id = ?
     ORDER BY name ASC`,
    [organizationId],
  );

  return rows;
}

export async function updateDepartment(id, data) {
  const [result] = await pool.execute(
    `UPDATE departments
     SET name = ?, description = ?
     WHERE id = ?`,
    [
      data.name,
      data.description ?? null,
      id,
    ],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getDepartmentById(id);
}
