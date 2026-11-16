import pool from "../config/database.js";

const allowedFilters = new Set(["APPLIED", "SCREENING", "SHORTLISTED", "REJECTED"]);

export async function getApplicationDashboardCounts(organizationId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN status = 'APPLIED' THEN 1 ELSE 0 END) AS new_count,
       SUM(CASE WHEN status = 'SCREENING' THEN 1 ELSE 0 END) AS screening_count,
       SUM(CASE WHEN status = 'SHORTLISTED' THEN 1 ELSE 0 END) AS shortlisted_count
     FROM applications WHERE organization_id = ?`,
    [organizationId]
  );
  const row = rows[0];
  return {
    total: Number(row.total),
    new: Number(row.new_count),
    screening: Number(row.screening_count),
    shortlisted: Number(row.shortlisted_count),
  };
}

export async function listApplications({ organizationId, search, status, stage, limit, offset }) {
  const filters = ["a.organization_id = ?"];
  const parameters = [organizationId];
  if (status && allowedFilters.has(status)) {
    filters.push("a.status = ?");
    parameters.push(status);
  }
  if (stage) {
    filters.push("a.current_stage = ?");
    parameters.push(stage);
  }
  if (search) {
    filters.push("(c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR j.title LIKE ?)");
    const term = `%${search}%`;
    parameters.push(term, term, term, term);
  }
  const where = filters.join(" AND ");
  const [rows] = await pool.execute(
    `SELECT a.id, a.job_id, j.title AS job_title, a.candidate_id,
       c.first_name, c.last_name, c.email, a.status, a.current_stage,
       a.applied_at, a.updated_at
     FROM applications a
     INNER JOIN candidates c ON c.id = a.candidate_id AND c.organization_id = a.organization_id
     INNER JOIN jobs j ON j.id = a.job_id AND j.organization_id = a.organization_id
     WHERE ${where}
     ORDER BY a.applied_at DESC, a.id DESC LIMIT ? OFFSET ?`,
    [...parameters, limit, offset]
  );
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM applications a
     INNER JOIN candidates c ON c.id = a.candidate_id AND c.organization_id = a.organization_id
     INNER JOIN jobs j ON j.id = a.job_id AND j.organization_id = a.organization_id
     WHERE ${where}`,
    parameters
  );
  return { items: rows, total: Number(countRows[0].total) };
}

export async function getApplicationDetails(applicationId, organizationId) {
  const [rows] = await pool.execute(
    `SELECT a.id, a.organization_id, a.candidate_id, a.job_id, a.status,
       a.current_stage, a.decision, a.decision_comments, a.applied_at, a.updated_at,
       c.first_name, c.last_name, c.email, c.phone, c.resume_url,
       c.created_at AS candidate_created_at,
       j.title AS job_title, j.jd_content, j.status AS job_status
     FROM applications a
     INNER JOIN candidates c ON c.id = a.candidate_id AND c.organization_id = a.organization_id
     INNER JOIN jobs j ON j.id = a.job_id AND j.organization_id = a.organization_id
     WHERE a.id = ? AND a.organization_id = ? LIMIT 1`,
    [applicationId, organizationId]
  );
  return rows[0] ?? null;
}

export async function updateApplicationProgress({ applicationId, organizationId, userId, status, stage, decisionComments }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT id, status, current_stage FROM applications
       WHERE id = ? AND organization_id = ? FOR UPDATE`,
      [applicationId, organizationId]
    );
    if (!rows[0]) {
      await connection.rollback();
      return null;
    }
    const previousStatus = rows[0].status;
    if (["SHORTLISTED", "REJECTED"].includes(previousStatus)) {
      await connection.rollback();
      const error = new Error("This application has already reached a final decision");
      error.statusCode = 409;
      throw error;
    }
    await connection.execute(
      `UPDATE applications
       SET status = ?, current_stage = ?,
           decision_comments = COALESCE(?, decision_comments)
       WHERE id = ? AND organization_id = ?`,
      [status, stage, decisionComments, applicationId, organizationId]
    );
    if (previousStatus !== status) {
      await connection.execute(
        `INSERT INTO application_status_history
         (application_id, from_status, to_status, changed_by)
         VALUES (?, ?, ?, ?)`,
        [applicationId, previousStatus, status, userId]
      );
    }
    await connection.commit();
    return getApplicationDetails(applicationId, organizationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
