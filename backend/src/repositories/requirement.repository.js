
import pool from "../config/database.js";

// Create a recruitment requirement
export async function createRequirement(data) {
  const [result] = await pool.execute(
    `INSERT INTO job_requirements
      (
        organization_id,
        department_id,
        created_by,
        title,
        openings,
        experience_min_years,
        experience_max_years,
        location,
        employment_type,
        description
      )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.organization_id,
      data.department_id ?? null,
      data.created_by,
      data.title,
      data.openings ?? 1,
      data.experience_min_years ?? null,
      data.experience_max_years ?? null,
      data.location ?? null,
      data.employment_type ?? null,
      data.description ?? null,
    ]
  );

  return getRequirementById(result.insertId, data.organization_id);
}

// Get requirement by ID within an organization
export async function getRequirementById(id, organizationId) {
  const [rows] = await pool.execute(
    `SELECT
       jr.id,
       jr.organization_id,
       jr.department_id,
       d.name AS department_name,
       jr.created_by,
       CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS created_by_name,
       jr.title,
       jr.openings,
       jr.experience_min_years,
       jr.experience_max_years,
       jr.location,
       jr.employment_type,
       jr.description,
       jr.status,
       jr.created_at,
       jr.updated_at
     FROM job_requirements jr
     LEFT JOIN departments d ON d.id = jr.department_id
     INNER JOIN users u ON u.id = jr.created_by
     WHERE jr.id = ?
       AND jr.organization_id = ?
     LIMIT 1`,
    [id, organizationId]
  );

  return rows[0] ?? null;
}

// Get all requirements belonging to an organization
export async function getRequirementsByOrganization(organizationId) {
  const [rows] = await pool.execute(
    `SELECT
       jr.id,
       jr.organization_id,
       jr.department_id,
       d.name AS department_name,
       jr.created_by,
       CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS created_by_name,
       jr.title,
       jr.openings,
       jr.experience_min_years,
       jr.experience_max_years,
       jr.location,
       jr.employment_type,
       jr.description,
       jr.status,
       jr.created_at,
       jr.updated_at
     FROM job_requirements jr
     LEFT JOIN departments d ON d.id = jr.department_id
     INNER JOIN users u ON u.id = jr.created_by
     WHERE jr.organization_id = ?
     ORDER BY jr.created_at DESC`,
    [organizationId]
  );

  return rows;
}

// Check whether a department belongs to an organization
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

// Update a draft requirement
export async function updateRequirement(id, organizationId, data) {
  const [result] = await pool.execute(
    `UPDATE job_requirements
     SET department_id = ?,
         title = ?,
         openings = ?,
         experience_min_years = ?,
         experience_max_years = ?,
         location = ?,
         employment_type = ?,
         description = ?
     WHERE id = ?
       AND organization_id = ?
       AND status = 'DRAFT'`,
    [
      data.department_id ?? null,
      data.title,
      data.openings ?? 1,
      data.experience_min_years ?? null,
      data.experience_max_years ?? null,
      data.location ?? null,
      data.employment_type ?? null,
      data.description ?? null,
      id,
      organizationId,
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getRequirementById(id, organizationId);
}
