import pool from "../config/database.js";

const detailSelect = `SELECT i.id, i.application_id, i.interview_type, i.title,
 i.scheduled_at, i.duration_minutes, i.meeting_url, i.location, i.status, i.created_by,
 a.organization_id, a.status AS application_status,
 c.first_name AS candidate_first_name, c.last_name AS candidate_last_name, j.title AS job_title
 FROM interviews i
 JOIN applications a ON a.id = i.application_id
 JOIN candidates c ON c.id = a.candidate_id AND c.organization_id = a.organization_id
 JOIN jobs j ON j.id = a.job_id AND j.organization_id = a.organization_id`;

export async function listInterviews(orgId, userId, interviewerOnly = false) {
  const assignmentJoin = interviewerOnly
    ? "JOIN interview_panel_members mine ON mine.interview_id = i.id AND mine.user_id = ?"
    : "";
  const parameters = interviewerOnly ? [userId, orgId] : [orgId];
  const [rows] = await pool.execute(
    `${detailSelect} ${assignmentJoin} WHERE a.organization_id = ? ORDER BY i.scheduled_at DESC`,
    parameters,
  );
  return rows;
}

export async function getInterview(id, orgId, userId, interviewerOnly = false) {
  const assignmentFilter = interviewerOnly
    ? "AND EXISTS (SELECT 1 FROM interview_panel_members mine WHERE mine.interview_id = i.id AND mine.user_id = ?)"
    : "";
  const parameters = interviewerOnly ? [id, orgId, userId] : [id, orgId];
  const [rows] = await pool.execute(
    `${detailSelect} WHERE i.id = ? AND a.organization_id = ? ${assignmentFilter} LIMIT 1`,
    parameters,
  );
  if (!rows[0]) return null;

  const [panel] = await pool.execute(
    `SELECT u.id, u.first_name, u.last_name, u.email
     FROM interview_panel_members ip
     JOIN interviews i ON i.id = ip.interview_id
     JOIN applications a ON a.id = i.application_id AND a.organization_id = ?
     JOIN users u ON u.id = ip.user_id AND u.organization_id = a.organization_id
     WHERE ip.interview_id = ? ORDER BY u.first_name, u.last_name`,
    [orgId, id],
  );
  const [feedback] = await pool.execute(
    `SELECT f.id, f.interviewer_id, f.rating, f.recommendation, f.strengths, f.weaknesses, f.comments,
       u.first_name, u.last_name
     FROM interview_feedback f
     JOIN interviews i ON i.id = f.interview_id
     JOIN applications a ON a.id = i.application_id AND a.organization_id = ?
     JOIN users u ON u.id = f.interviewer_id AND u.organization_id = a.organization_id
     WHERE f.interview_id = ?`,
    [orgId, id],
  );
  return { ...rows[0], panel_members: panel, feedback };
}

export async function getActiveInterviewers(orgId, ids) {
  const [rows] = await pool.execute(
    `SELECT u.id FROM users u
     WHERE u.organization_id = ? AND u.is_active = 1 AND u.role_id = 4
       AND u.id IN (${ids.map(() => "?").join(",")})`,
    [orgId, ...ids],
  );
  return rows.map((row) => Number(row.id));
}

export async function createInterview(data) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [interviewers] = await connection.execute(
      `SELECT id FROM users
       WHERE organization_id = ? AND is_active = 1 AND role_id = 4
         AND id IN (${data.panel_member_ids.map(() => "?").join(",")}) FOR UPDATE`,
      [data.organization_id, ...data.panel_member_ids],
    );
    if (interviewers.length !== data.panel_member_ids.length) {
      const error = new Error("Every panel member must be an active interviewer in this organization");
      error.statusCode = 400;
      throw error;
    }
    const [applications] = await connection.execute(
      `SELECT id FROM applications
       WHERE id = ? AND organization_id = ? AND status = 'SHORTLISTED' FOR UPDATE`,
      [data.application_id, data.organization_id],
    );
    if (!applications[0]) {
      const error = new Error("Application not found or not shortlisted");
      error.statusCode = 409;
      throw error;
    }
    const [result] = await connection.execute(
      `INSERT INTO interviews
       (application_id, interview_type, title, scheduled_at, duration_minutes, meeting_url, location, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.application_id, data.interview_type, data.title, data.scheduled_at, data.duration_minutes,
        data.meeting_url, data.location, "SCHEDULED", data.created_by],
    );
    for (const userId of data.panel_member_ids) {
      await connection.execute(
        `INSERT INTO interview_panel_members (interview_id, user_id) VALUES (?, ?)`,
        [result.insertId, userId],
      );
    }
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function changeInterview(id, orgId, patch) {
  const columns = {
    interview_type: "interview_type",
    title: "title",
    scheduled_at: "scheduled_at",
    duration_minutes: "duration_minutes",
    meeting_url: "meeting_url",
    location: "location",
    status: "status",
  };
  const fields = [];
  const values = [];
  for (const [key, column] of Object.entries(columns)) {
    if (patch[key] !== undefined) {
      fields.push(`i.${column} = ?`);
      values.push(patch[key]);
    }
  }
  if (!fields.length) return 0;
  const [result] = await pool.execute(
    `UPDATE interviews i
     JOIN applications a ON a.id = i.application_id
     SET ${fields.join(", ")}
     WHERE i.id = ? AND a.organization_id = ?`,
    [...values, id, orgId],
  );
  return result.affectedRows;
}

export async function completeInterview(id, orgId, userId, interviewerOnly) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT i.id, i.status,
         EXISTS (
           SELECT 1 FROM interview_panel_members ip
           WHERE ip.interview_id = i.id AND ip.user_id = ?
         ) AS is_assigned
       FROM interviews i
       JOIN applications a ON a.id = i.application_id
       WHERE i.id = ? AND a.organization_id = ?
       FOR UPDATE`,
      [userId, id, orgId],
    );
    const interview = rows[0];
    if (!interview) {
      const error = new Error("Interview not found");
      error.statusCode = 404;
      throw error;
    }
    if (interviewerOnly && !Number(interview.is_assigned)) {
      const error = new Error("You are not assigned to this interview");
      error.statusCode = 403;
      throw error;
    }
    if (interview.status !== "SCHEDULED") {
      const error = new Error("Only scheduled interviews can be completed");
      error.statusCode = 409;
      throw error;
    }
    const [result] = await connection.execute(
      `UPDATE interviews i
       JOIN applications a ON a.id = i.application_id
       SET i.status = 'COMPLETED'
       WHERE i.id = ? AND a.organization_id = ? AND i.status = 'SCHEDULED'`,
      [id, orgId],
    );
    if (!result.affectedRows) {
      const error = new Error("Interview status changed before completion");
      error.statusCode = 409;
      throw error;
    }
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function addFeedback(data) {
  const [result] = await pool.execute(
    `INSERT INTO interview_feedback
       (interview_id, interviewer_id, rating, recommendation, strengths, weaknesses, comments)
     SELECT i.id, u.id, ?, ?, ?, ?, ?
     FROM interviews i
     JOIN applications a ON a.id = i.application_id AND a.organization_id = ?
     JOIN interview_panel_members ip ON ip.interview_id = i.id AND ip.user_id = ?
     JOIN users u ON u.id = ip.user_id AND u.organization_id = a.organization_id
       AND u.is_active = 1 AND u.role_id = 4
     WHERE i.id = ? AND i.status = 'COMPLETED'`,
    [data.rating, data.recommendation, data.strengths, data.weaknesses, data.comments,
      data.organization_id, data.interviewer_id, data.interview_id],
  );
  if (result.affectedRows !== 1) {
    const error = new Error("Interview not found or interviewer is not assigned");
    error.statusCode = 404;
    throw error;
  }
  return result.insertId;
}
