
import pool from "../config/database.js";

export async function createOrganization(data) {
  const [result] = await pool.execute(
    `INSERT INTO organizations (name, slug, email)
     VALUES (?, ?, ?)`,
    [data.name, data.slug, data.email ?? null]
  );

  const insertId = result.insertId;

  const [rows] = await pool.execute(
    `SELECT id, name, slug, email, is_active, created_at
     FROM organizations
     WHERE id = ?`,
    [insertId]
  );

  return rows[0];
}


export async function getAllOrganizations(){
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
