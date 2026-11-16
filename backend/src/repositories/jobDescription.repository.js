import pool from "../config/database.js";

const jobSelect = `SELECT j.id, j.requirement_id, j.organization_id, j.workflow_id,
       j.title, j.jd_content, j.status, j.published_at,
       j.created_at, j.updated_at, jr.title AS requirement_title
     FROM jobs j
     INNER JOIN job_requirements jr
       ON jr.id = j.requirement_id AND jr.organization_id = j.organization_id`;

export async function createJobDescriptionFromRequirement(requirementId, organizationId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [requirements] = await connection.execute(
      `SELECT id, title, description, status
       FROM job_requirements
       WHERE id = ? AND organization_id = ?
       FOR UPDATE`,
      [requirementId, organizationId]
    );
    const requirement = requirements[0];
    if (!requirement) {
      const error = new Error("Approved requirement not found in this organization");
      error.statusCode = 404;
      throw error;
    }
    if (requirement.status !== "APPROVED") {
      const error = new Error("A JD can only be created from an approved requirement");
      error.statusCode = 409;
      throw error;
    }

    const [existing] = await connection.execute(
      `SELECT id FROM jobs
       WHERE organization_id = ? AND requirement_id = ?
       LIMIT 1`,
      [organizationId, requirementId]
    );
    if (existing.length) {
      const error = new Error("A JD already exists for this requirement");
      error.statusCode = 409;
      throw error;
    }

    const [result] = await connection.execute(
      `INSERT INTO jobs
       (organization_id, requirement_id, title, jd_content, status)
       VALUES (?, ?, ?, ?, 'DRAFT')`,
      [organizationId, requirementId, requirement.title, requirement.description ?? ""]
    );
    await connection.commit();
    return getJobDescriptionById(result.insertId, organizationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getJobDescriptionsByOrganization(organizationId) {
  const [rows] = await pool.execute(
    `${jobSelect}
     WHERE j.organization_id = ?
     ORDER BY j.created_at DESC`,
    [organizationId]
  );
  return rows;
}

export async function getAllJobDescriptions() {
  const [rows] = await pool.execute(
    `${jobSelect}
     ORDER BY j.created_at DESC`
  );
  return rows;
}

export async function getJobDescriptionById(id, organizationId) {
  const [rows] = await pool.execute(
    `${jobSelect}
     WHERE j.id = ? AND j.organization_id = ?
     LIMIT 1`,
    [id, organizationId]
  );
  return rows[0] ?? null;
}

export async function getJobDescriptionByIdForPlatform(id) {
  const [rows] = await pool.execute(
    `${jobSelect}
     WHERE j.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function updateJobDescriptionDraft(id, organizationId, data) {
  const [result] = await pool.execute(
    `UPDATE jobs
     SET title = ?, jd_content = ?
     WHERE id = ? AND organization_id = ? AND status IN ('DRAFT', 'REJECTED')`,
    [data.title, data.jd_content, id, organizationId]
  );
  if (!result.affectedRows) return null;
  return getJobDescriptionById(id, organizationId);
}

export async function publishJobDescription(id, organizationId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [jobs] = await connection.execute(
      `SELECT id, status FROM jobs
       WHERE id = ? AND organization_id = ?
       FOR UPDATE`,
      [id, organizationId]
    );
    if (!jobs[0]) {
      const error = new Error("JD not found");
      error.statusCode = 404;
      throw error;
    }
    if (jobs[0].status !== "APPROVED") {
      const error = new Error("Only an approved JD can be published");
      error.statusCode = 409;
      throw error;
    }
    await connection.execute(
      `UPDATE jobs SET status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ? AND status = 'APPROVED'`,
      [id, organizationId]
    );
    await connection.commit();
    return getJobDescriptionById(id, organizationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getJobDescriptionApprovalHistory(id, organizationId) {
  const [rows] = await pool.execute(
    `SELECT ar.id, ar.approval_workflow_id, ar.organization_id, ar.entity_type,
       ar.entity_id, ar.current_step, ar.status, ar.requested_by,
       ar.completed_at, ar.created_at, ar.updated_at, aw.name AS workflow_name
     FROM approval_requests ar
     INNER JOIN approval_workflows aw ON aw.id = ar.approval_workflow_id
     WHERE ar.organization_id = ? AND ar.entity_type = 'JOB' AND ar.entity_id = ?
     ORDER BY ar.created_at DESC, ar.id DESC`,
    [organizationId, id]
  );
  if (!rows.length) return { requests: [] };
  const requestIds = rows.map((request) => request.id);
  const placeholders = requestIds.map(() => "?").join(", ");
  const [actions] = await pool.execute(
    `SELECT aa.id, aa.approval_request_id, aa.step_order, aa.approver_id,
       CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS approver_name,
       aa.action, aa.comments, aa.action_at
     FROM approval_actions aa
     INNER JOIN approval_requests ar ON ar.id = aa.approval_request_id
     LEFT JOIN users u ON u.id = aa.approver_id
     WHERE ar.id IN (${placeholders}) AND ar.organization_id = ?
     ORDER BY aa.step_order ASC, aa.action_at ASC, aa.id ASC`,
    [...requestIds, organizationId]
  );
  return {
    requests: rows.map((request) => ({
      ...request,
      actions: actions.filter((action) => Number(action.approval_request_id) === Number(request.id)),
    })),
  };
}

export async function getPendingJobApprovalRequestId(id, organizationId) {
  const [rows] = await pool.execute(
    `SELECT id
     FROM approval_requests
     WHERE organization_id = ? AND entity_type = 'JOB' AND entity_id = ? AND status = 'PENDING'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [organizationId, id]
  );
  return rows[0]?.id ?? null;
}
