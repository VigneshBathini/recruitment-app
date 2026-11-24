import pool from "../config/database.js";

const allowedFilters = new Set(["APPLIED", "SCREENING", "SHORTLISTED", "REJECTED", "WITHDRAWN", "HIRED"]);

export async function getApplicationDashboardCounts(organizationId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN status = 'APPLIED' THEN 1 ELSE 0 END) AS new_count,
       SUM(CASE WHEN status = 'SCREENING' THEN 1 ELSE 0 END) AS screening_count,
       SUM(CASE WHEN status = 'SHORTLISTED' THEN 1 ELSE 0 END) AS shortlisted_count,
       SUM(CASE WHEN status = 'WITHDRAWN' THEN 1 ELSE 0 END) AS withdrawn_count,
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
    withdrawn: Number(row.withdrawn_count),
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
       c.first_name, c.last_name, c.email, c.phone,
       (a.resume_url IS NOT NULL) AS has_resume_snapshot,
       c.created_at AS candidate_created_at,
       j.title AS job_title, j.jd_content, j.status AS job_status
     FROM applications a
     INNER JOIN candidates c ON c.id = a.candidate_id AND c.organization_id = a.organization_id
     INNER JOIN jobs j ON j.id = a.job_id AND j.organization_id = a.organization_id
     LEFT JOIN users decision_user ON decision_user.id = a.decision_by AND decision_user.organization_id = a.organization_id
     WHERE a.id = ? AND a.organization_id = ? LIMIT 1`,
    [applicationId, organizationId]
  );
  if (!rows[0]) return null;
  const [history] = await pool.execute(
    `SELECT h.id, h.from_status, h.to_status, h.changed_by, h.actor_type, h.actor_id,
       h.reason, h.changed_at,
       CASE WHEN h.actor_type = 'CANDIDATE' THEN CONCAT_WS(' ', c.first_name, c.last_name)
            ELSE CONCAT_WS(' ', u.first_name, u.last_name) END AS actor_name
     FROM application_status_history h
     INNER JOIN applications a ON a.id = h.application_id AND a.organization_id = ?
     LEFT JOIN users u ON h.actor_type = 'MANAGEMENT_USER' AND u.id = h.actor_id AND u.organization_id = a.organization_id
     LEFT JOIN candidates c ON h.actor_type = 'CANDIDATE' AND c.id = h.actor_id AND c.organization_id = a.organization_id
     WHERE h.application_id = ? ORDER BY h.changed_at ASC, h.id ASC`,
    [organizationId, applicationId],
  );
  const [stageHistory] = await pool.execute(
    `SELECT h.id, h.previous_value AS from_stage, h.new_value AS to_stage,
       h.actor_type, h.actor_id, h.created_at AS changed_at,
       h.action, h.reason,
       CASE WHEN h.actor_type = 'CANDIDATE' THEN CONCAT_WS(' ', c.first_name, c.last_name)
            ELSE CONCAT_WS(' ', u.first_name, u.last_name) END AS actor_name
     FROM workflow_history h
     INNER JOIN applications a ON a.id = h.entity_id AND a.organization_id = h.organization_id
     LEFT JOIN users u ON h.actor_type = 'MANAGEMENT_USER' AND u.id = h.actor_id AND u.organization_id = a.organization_id
     LEFT JOIN candidates c ON h.actor_type = 'CANDIDATE' AND c.id = h.actor_id AND c.organization_id = a.organization_id
     WHERE h.organization_id = ? AND h.entity_type = 'APPLICATION'
       AND h.field_name = 'current_stage' AND h.entity_id = ?
     ORDER BY h.created_at ASC, h.id ASC`,
    [organizationId, applicationId],
  );
  return { ...rows[0], status_history: history, stage_history: stageHistory };
}

export async function getApplicationResumeKey(applicationId, organizationId) {
  const [rows] = await pool.execute(
    `SELECT a.resume_url, a.id
     FROM applications a
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
      `SELECT a.id, a.status, a.current_stage, a.decision,
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
    const nextStage = decision === "REJECTED" ? "REJECTED" : application.current_stage;
    await connection.execute(
      `UPDATE applications SET decision = ?, decision_by = ?, decision_at = CURRENT_TIMESTAMP,
         decision_comments = CASE
           WHEN decision_comments IS NULL OR TRIM(decision_comments) = '' THEN ?
           ELSE CONCAT(decision_comments, CHAR(10), CHAR(10), 'Hiring Manager decision: ', ?)
         END,
         status = ?, current_stage = ? WHERE id = ? AND organization_id = ? AND decision IS NULL`,
      [decision, userId, comments, comments, nextStatus, nextStage, applicationId, organizationId],
    );
    if (application.status !== nextStatus) {
      await connection.execute(
        `INSERT INTO application_status_history
         (application_id, from_status, to_status, changed_by, actor_type, actor_id, reason)
         VALUES (?, ?, ?, ?, 'MANAGEMENT_USER', ?, ?)`,
        [applicationId, application.status, nextStatus, userId, userId, comments],
      );
    }
    if (application.current_stage !== nextStage) {
      await connection.execute(
        `INSERT INTO workflow_history
         (organization_id, entity_type, entity_id, action, field_name, previous_value, new_value, actor_type, actor_id, reason)
         VALUES (?, 'APPLICATION', ?, 'STAGE_CHANGED', 'current_stage', ?, ?, 'MANAGEMENT_USER', ?, ?)`,
        [organizationId, applicationId, application.current_stage, nextStage, userId, comments],
      );
    }
    await connection.commit();
    return getApplicationReviewDetails(applicationId, organizationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateApplicationProgress({ applicationId, organizationId, userId, status, stage, decisionComments, reason = null }) {
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
    const previousStage = rows[0].current_stage;
    if (["SHORTLISTED", "REJECTED", "WITHDRAWN", "HIRED"].includes(previousStatus)) {
      await connection.rollback();
      const error = new Error("This application has already reached a final decision");
      error.statusCode = 409;
      throw error;
    }
    const allowedStages = ["SCREENING", "PHONE_SCREEN", "TECHNICAL_INTERVIEW", "HR_INTERVIEW", "OFFER"];
    if (status === "SCREENING") {
      const previousStageIndex = previousStage === "APPLICATION" ? -1 : allowedStages.indexOf(previousStage);
      const nextStageIndex = allowedStages.indexOf(stage);
      const previousStageIsValid = previousStage === "APPLICATION"
        ? previousStatus === "APPLIED"
        : allowedStages.includes(previousStage);
      if (!previousStageIsValid || nextStageIndex < 0 || nextStageIndex < previousStageIndex) {
        await connection.rollback();
        const error = new Error("Application stage cannot move backwards or to an unsupported stage");
        error.statusCode = 409;
        throw error;
      }
    } else if (status === "SHORTLISTED") {
      if (previousStatus !== "SCREENING" || !allowedStages.includes(previousStage) || stage !== "SHORTLISTED") {
        await connection.rollback();
        const error = new Error("Only an application in screening can be shortlisted");
        error.statusCode = 409;
        throw error;
      }
    } else if (status === "REJECTED") {
      if (!(["APPLIED", "SCREENING"].includes(previousStatus)) || stage !== "REJECTED") {
        await connection.rollback();
        const error = new Error("Application cannot be rejected from its current state");
        error.statusCode = 409;
        throw error;
      }
    } else {
      await connection.rollback();
      const error = new Error("Unsupported application status transition");
      error.statusCode = 409;
      throw error;
    }
    const stageChanged = previousStage !== stage;
    const statusChanged = previousStatus !== status;
    if (!stageChanged && !statusChanged) {
      await connection.commit();
      return getApplicationDetails(applicationId, organizationId);
    }
    await connection.execute(
      `UPDATE applications
       SET status = ?, current_stage = ?,
           decision_comments = COALESCE(?, decision_comments)
       WHERE id = ? AND organization_id = ?`,
      [status, stage, decisionComments, applicationId, organizationId]
    );
    if (statusChanged) {
      await connection.execute(
        `INSERT INTO application_status_history
         (application_id, from_status, to_status, changed_by, actor_type, actor_id, reason)
         VALUES (?, ?, ?, ?, 'MANAGEMENT_USER', ?, ?)`,
        [applicationId, previousStatus, status, userId, userId, reason]
      );
    }
    if (stageChanged) {
      await connection.execute(
        `INSERT INTO workflow_history
         (organization_id, entity_type, entity_id, action, field_name, previous_value, new_value, actor_type, actor_id, reason)
         VALUES (?, 'APPLICATION', ?, 'STAGE_CHANGED', 'current_stage', ?, ?, 'MANAGEMENT_USER', ?, ?)`,
        [organizationId, applicationId, previousStage, stage, userId, reason],
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

export async function withdrawApplication({ applicationId, organizationId, actorId, actorType, reason, candidateId = null }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [applications] = await connection.execute(
      `SELECT a.id, a.status, a.current_stage,
         EXISTS (
           SELECT 1 FROM offers o
           WHERE o.application_id = a.id AND o.organization_id = a.organization_id AND o.status = 'ACCEPTED'
         ) AS has_accepted_offer
       FROM applications a
       WHERE a.id = ? AND a.organization_id = ? ${candidateId == null ? "" : "AND a.candidate_id = ?"}
       FOR UPDATE`,
      candidateId == null ? [applicationId, organizationId] : [applicationId, organizationId, candidateId],
    );
    const application = applications[0];
    if (!application) {
      await connection.rollback();
      return { error: "not_found" };
    }
    if (application.status === "HIRED") {
      await connection.rollback();
      return { error: "hired" };
    }
    if (["REJECTED", "WITHDRAWN"].includes(application.status)) {
      await connection.rollback();
      return { error: "not_withdrawable" };
    }
    if (candidateId != null && Number(application.has_accepted_offer)) {
      await connection.rollback();
      return { error: "accepted_offer" };
    }

    const [onboardings] = await connection.execute(
      `SELECT id, status FROM onboarding_records
       WHERE application_id = ? AND organization_id = ? AND status <> 'CANCELLED'
       FOR UPDATE`,
      [applicationId, organizationId],
    );
    if (onboardings.some((record) => !["INITIATED", "IN_PROGRESS", "READY_TO_JOIN", "COMPLETED"].includes(record.status))) {
      await connection.rollback();
      return { error: "onboarding_transition" };
    }

    const [updated] = await connection.execute(
      `UPDATE applications SET status = 'WITHDRAWN', current_stage = 'WITHDRAWN'
       WHERE id = ? AND organization_id = ? AND status = ? AND status NOT IN ('HIRED', 'REJECTED', 'WITHDRAWN')`,
      [applicationId, organizationId, application.status],
    );
    if (updated.affectedRows !== 1) {
      await connection.rollback();
      return { error: "not_withdrawable" };
    }
    await connection.execute(
      `INSERT INTO application_status_history
       (application_id, from_status, to_status, changed_by, actor_type, actor_id, reason)
       VALUES (?, ?, 'WITHDRAWN', ?, ?, ?, ?)`,
      [applicationId, application.status, actorType === "MANAGEMENT_USER" ? actorId : null, actorType, actorId, reason],
    );
    if (application.current_stage !== "WITHDRAWN") {
      await connection.execute(
        `INSERT INTO workflow_history
         (organization_id, entity_type, entity_id, action, field_name, previous_value, new_value, actor_type, actor_id, reason)
         VALUES (?, 'APPLICATION', ?, 'STAGE_CHANGED', 'current_stage', ?, 'WITHDRAWN', ?, ?, ?)`,
        [organizationId, applicationId, application.current_stage, actorType, actorId, reason],
      );
    }

    for (const onboarding of onboardings) {
      // COMPLETED is terminal in the existing onboarding state machine. Preserve
      // it as historical evidence; application withdrawal does not rewrite it.
      if (onboarding.status === "COMPLETED") continue;
      await connection.execute(
        `UPDATE onboarding_records SET status = 'CANCELLED'
         WHERE id = ? AND organization_id = ? AND status IN ('INITIATED', 'IN_PROGRESS', 'READY_TO_JOIN')`,
        [onboarding.id, organizationId],
      );
      await connection.execute(
        `INSERT INTO workflow_history
         (organization_id, entity_type, entity_id, action, field_name, previous_value, new_value, actor_type, actor_id)
         VALUES (?, 'ONBOARDING', ?, 'STATUS_CHANGED', 'status', ?, 'CANCELLED', ?, ?)`,
        [organizationId, onboarding.id, onboarding.status, actorType, actorId],
      );
      const [tasks] = await connection.execute(
        `SELECT id, status FROM onboarding_tasks
         WHERE onboarding_id = ? AND organization_id = ? AND status IN ('PENDING', 'IN_PROGRESS')
         FOR UPDATE`, [onboarding.id, organizationId],
      );
      for (const task of tasks) {
        await connection.execute(
          `UPDATE onboarding_tasks SET status = 'CANCELLED'
           WHERE id = ? AND organization_id = ? AND status IN ('PENDING', 'IN_PROGRESS')`,
          [task.id, organizationId],
        );
        await connection.execute(
          `INSERT INTO workflow_history
           (organization_id, entity_type, entity_id, action, field_name, previous_value, new_value, actor_type, actor_id)
           VALUES (?, 'ONBOARDING_TASK', ?, 'STATUS_CHANGED', 'status', ?, 'CANCELLED', ?, ?)`,
          [organizationId, task.id, task.status, actorType, actorId],
        );
      }
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
