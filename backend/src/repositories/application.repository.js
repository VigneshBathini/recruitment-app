import pool from "../config/database.js";

const allowedFilters = new Set(["APPLIED", "SCREENING", "SHORTLISTED", "REJECTED", "HIRED"]);

export async function getApplicationDashboardCounts(organizationId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN status = 'APPLIED' THEN 1 ELSE 0 END) AS new_count,
       SUM(CASE WHEN status = 'SCREENING' THEN 1 ELSE 0 END) AS screening_count,
       SUM(CASE WHEN status = 'SHORTLISTED' THEN 1 ELSE 0 END) AS shortlisted_count,
       SUM(CASE WHEN status = 'HIRED' THEN 1 ELSE 0 END) AS hired_count
     FROM applications WHERE organization_id = ?`,
    [organizationId]
  );
  const row = rows[0];
  return {
    total: Number(row.total),
    new: Number(row.new_count),
    screening: Number(row.screening_count),
    shortlisted: Number(row.shortlisted_count),
    hired: Number(row.hired_count),
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
       a.current_stage, a.decision, a.decision_by, a.decision_at, a.decision_comments, a.applied_at, a.updated_at,
       CONCAT_WS(' ', decision_user.first_name, decision_user.last_name) AS decision_by_name,
       c.first_name, c.last_name, c.email, c.phone, c.resume_url,
       c.created_at AS candidate_created_at,
       j.title AS job_title, j.jd_content, j.status AS job_status
     FROM applications a
     INNER JOIN candidates c ON c.id = a.candidate_id AND c.organization_id = a.organization_id
     INNER JOIN jobs j ON j.id = a.job_id AND j.organization_id = a.organization_id
     LEFT JOIN users decision_user ON decision_user.id = a.decision_by AND decision_user.organization_id = a.organization_id
     WHERE a.id = ? AND a.organization_id = ? LIMIT 1`,
    [applicationId, organizationId]
  );
  return rows[0] ?? null;
}

export async function listApplicationReviewQueue(organizationId) {
  const [rows] = await pool.execute(
    `SELECT a.id, a.candidate_id, a.job_id, a.status, a.current_stage,
       a.applied_at, a.decision, c.first_name, c.last_name, c.email,
       j.title AS job_title,
       COUNT(DISTINCT i.id) AS completed_interview_count,
       COUNT(DISTINCT f.id) > 0 AS feedback_available
     FROM applications a
     JOIN candidates c ON c.id = a.candidate_id AND c.organization_id = a.organization_id
     JOIN jobs j ON j.id = a.job_id AND j.organization_id = a.organization_id
     JOIN interviews i ON i.application_id = a.id AND i.status = 'COMPLETED'
     LEFT JOIN interview_feedback f ON f.interview_id = i.id
     WHERE a.organization_id = ? AND a.status = 'SHORTLISTED' AND a.decision IS NULL
     GROUP BY a.id, a.candidate_id, a.job_id, a.status, a.current_stage,
       a.applied_at, a.decision, c.first_name, c.last_name, c.email, j.title
     ORDER BY a.applied_at DESC, a.id DESC`,
    [organizationId],
  );
  return rows.map((row) => ({ ...row, completed_interview_count: Number(row.completed_interview_count), feedback_available: Boolean(row.feedback_available) }));
}

export async function getApplicationReviewDetails(applicationId, organizationId) {
  const application = await getApplicationDetails(applicationId, organizationId);
  if (!application) return null;
  const [interviews] = await pool.execute(
    `SELECT i.id, i.interview_type, i.title, i.scheduled_at, i.duration_minutes,
       i.meeting_url, i.location, i.status
     FROM interviews i
     JOIN applications a ON a.id = i.application_id
     WHERE a.id = ? AND a.organization_id = ? AND i.status = 'COMPLETED'
     ORDER BY i.scheduled_at DESC, i.id DESC`,
    [applicationId, organizationId],
  );
  for (const interview of interviews) {
    const [feedback] = await pool.execute(
      `SELECT f.id, f.interviewer_id, f.rating, f.recommendation,
         f.strengths, f.weaknesses, f.comments, u.first_name AS interviewer_first_name,
         u.last_name AS interviewer_last_name
       FROM interview_feedback f
       JOIN interviews i ON i.id = f.interview_id
       JOIN applications a ON a.id = i.application_id AND a.organization_id = ?
       JOIN users u ON u.id = f.interviewer_id AND u.organization_id = a.organization_id
       WHERE f.interview_id = ?
       ORDER BY u.first_name, u.last_name`,
      [organizationId, interview.id],
    );
    interview.feedback = feedback;
  }
  return { ...application, completed_interviews: interviews };
}

export async function decideOnApplication({ applicationId, organizationId, userId, decision, comments }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT a.id, a.status, a.decision,
         EXISTS (SELECT 1 FROM interviews i WHERE i.application_id = a.id AND i.status = 'COMPLETED') AS has_completed_interview
       FROM applications a WHERE a.id = ? AND a.organization_id = ? FOR UPDATE`,
      [applicationId, organizationId],
    );
    const application = rows[0];
    if (!application) {
      await connection.rollback();
      return null;
    }
    if (application.status !== "SHORTLISTED" || application.decision !== null) {
      const error = new Error("This application already has a final decision");
      error.statusCode = 409;
      throw error;
    }
    if (!Number(application.has_completed_interview)) {
      const error = new Error("A completed interview is required before an application decision");
      error.statusCode = 409;
      throw error;
    }
    const nextStatus = decision === "REJECTED" ? "REJECTED" : application.status;
    await connection.execute(
      `UPDATE applications SET decision = ?, decision_by = ?, decision_at = CURRENT_TIMESTAMP,
         decision_comments = CASE
           WHEN decision_comments IS NULL OR TRIM(decision_comments) = '' THEN ?
           ELSE CONCAT(decision_comments, CHAR(10), CHAR(10), 'Hiring Manager decision: ', ?)
         END,
         status = ? WHERE id = ? AND organization_id = ? AND decision IS NULL`,
      [decision, userId, comments, comments, nextStatus, applicationId, organizationId],
    );
    await connection.execute(
      `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by)
       VALUES (?, ?, ?, ?)`,
      [applicationId, application.status, nextStatus, userId],
    );
    await connection.commit();
    return getApplicationReviewDetails(applicationId, organizationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
    if (["SHORTLISTED", "REJECTED", "HIRED"].includes(previousStatus)) {
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
