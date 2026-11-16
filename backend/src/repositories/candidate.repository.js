import pool from "../config/database.js";

const candidateProfileFields = `id, first_name, last_name, email, phone, resume_url, created_at, updated_at`;

export async function createCandidate({ organizationSlug, firstName, lastName, email, passwordHash }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [organizations] = await connection.execute(
      `SELECT id FROM organizations WHERE slug = ? AND is_active = 1 FOR UPDATE`,
      [organizationSlug]
    );
    if (!organizations[0]) {
      await connection.rollback();
      return null;
    }

    const [result] = await connection.execute(
      `INSERT INTO candidates
       (organization_id, first_name, last_name, email, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [organizations[0].id, firstName, lastName ?? null, email, passwordHash]
    );
    const [rows] = await connection.execute(
      `SELECT ${candidateProfileFields} FROM candidates WHERE id = ? AND organization_id = ? LIMIT 1`,
      [result.insertId, organizations[0].id]
    );
    await connection.commit();
    return { ...rows[0], organization_id: Number(organizations[0].id) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findCandidateForLogin(email, organizationSlug) {
  const [rows] = await pool.execute(
    `SELECT c.id, c.organization_id, c.first_name, c.last_name, c.email,
       c.phone, c.resume_url,
       c.password_hash, c.is_active, o.slug AS organization_slug,
       o.is_active AS organization_is_active
     FROM candidates c
     INNER JOIN organizations o ON o.id = c.organization_id
     WHERE c.email = ? AND o.slug = ?
     LIMIT 1`,
    [email, organizationSlug]
  );
  return rows[0] ?? null;
}

export async function findCandidateById(id) {
  const [rows] = await pool.execute(
    `SELECT c.id, c.organization_id, c.first_name, c.last_name, c.email,
       c.phone, c.resume_url, c.is_active,
       o.slug AS organization_slug, o.is_active AS organization_is_active
     FROM candidates c
     INNER JOIN organizations o ON o.id = c.organization_id
     WHERE c.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getCandidateProfile(candidateId, organizationId) {
  const [rows] = await pool.execute(
    `SELECT ${candidateProfileFields}
     FROM candidates WHERE id = ? AND organization_id = ? LIMIT 1`,
    [candidateId, organizationId]
  );
  return rows[0] ?? null;
}

export async function updateCandidateProfile(candidateId, organizationId, data) {
  const fields = [];
  const values = [];
  if (Object.hasOwn(data, "first_name")) {
    fields.push("first_name = ?");
    values.push(data.first_name);
  }
  if (Object.hasOwn(data, "last_name")) {
    fields.push("last_name = ?");
    values.push(data.last_name ?? null);
  }
  if (Object.hasOwn(data, "phone")) {
    fields.push("phone = ?");
    values.push(data.phone ?? null);
  }

  const [result] = await pool.execute(
    `UPDATE candidates SET ${fields.join(", ")}
     WHERE id = ? AND organization_id = ? AND is_active = 1`,
    [...values, candidateId, organizationId]
  );
  if (!result.affectedRows) {
    const current = await getCandidateProfile(candidateId, organizationId);
    return current;
  }
  return getCandidateProfile(candidateId, organizationId);
}

export async function createCandidateApplication(candidateId, organizationId, jobId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [candidates] = await connection.execute(
      `SELECT id FROM candidates
       WHERE id = ? AND organization_id = ? AND is_active = 1 FOR UPDATE`,
      [candidateId, organizationId]
    );
    if (!candidates[0]) {
      await connection.rollback();
      return { error: "candidate_not_found" };
    }

    const [jobs] = await connection.execute(
      `SELECT id FROM jobs
       WHERE id = ? AND organization_id = ? AND status = 'PUBLISHED' FOR UPDATE`,
      [jobId, organizationId]
    );
    if (!jobs[0]) {
      await connection.rollback();
      return { error: "job_not_found" };
    }

    const [result] = await connection.execute(
      `INSERT INTO applications (organization_id, candidate_id, job_id, status, current_stage)
       VALUES (?, ?, ?, 'APPLIED', 'APPLICATION')`,
      [organizationId, candidateId, jobId]
    );
    await connection.execute(
      `INSERT INTO application_status_history
       (application_id, from_status, to_status, changed_by)
       VALUES (?, NULL, 'APPLIED', NULL)`,
      [result.insertId]
    );
    await connection.commit();
    return { id: result.insertId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getCandidateApplications(candidateId, organizationId) {
  const [rows] = await pool.execute(
    `SELECT a.id, a.job_id, j.title AS job_title, a.status, a.current_stage,
       a.applied_at, a.updated_at, a.decision
     FROM applications a
     INNER JOIN jobs j
       ON j.id = a.job_id AND j.organization_id = a.organization_id
     WHERE a.candidate_id = ? AND a.organization_id = ?
     ORDER BY a.applied_at DESC, a.id DESC`,
    [candidateId, organizationId]
  );
  return rows;
}
