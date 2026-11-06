import pool from "../config/database.js";

// Entity ownership checks stay domain-specific and use fixed SQL only.
const entityOwnershipChecks = new Map([
  ["JOB_REQUIREMENT", async (connection, entityId, organizationId) => {
    const [rows] = await connection.execute(
      `SELECT id FROM job_requirements
       WHERE id = ? AND organization_id = ? LIMIT 1`,
      [entityId, organizationId]
    );
    return rows.length > 0;
  }],
]);

async function assertEntityOwnership(connection, entityType, entityId, organizationId) {
  const ownershipCheck = entityOwnershipChecks.get(entityType);
  if (!ownershipCheck) {
    const error = new Error(`Unsupported approval entity type: ${entityType}`);
    error.statusCode = 400;
    throw error;
  }

  if (!(await ownershipCheck(connection, entityId, organizationId))) {
    const error = new Error("Approval entity not found in this organization");
    error.statusCode = 404;
    throw error;
  }
}

export async function getApprovalWorkflows(organizationId, entityType) {
  const [rows] = await pool.execute(
    `SELECT id, organization_id, name, entity_type, is_active, created_at, updated_at
     FROM approval_workflows
     WHERE organization_id = ? AND entity_type = ? AND is_active = 1
     ORDER BY name ASC`,
    [organizationId, entityType]
  );

  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(", ");
  const [steps] = await pool.execute(
    `SELECT id, approval_workflow_id, step_order, approver_role_id, name, created_at
     FROM approval_workflow_steps
     WHERE approval_workflow_id IN (${placeholders})
     ORDER BY step_order ASC`,
    ids
  );
  return rows.map((workflow) => ({
    ...workflow,
    steps: steps.filter((step) => Number(step.approval_workflow_id) === Number(workflow.id)),
  }));
}

export async function createApprovalRequest({ organizationId, workflowId, entityType, entityId, requestedBy }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [workflows] = await connection.execute(
      `SELECT id FROM approval_workflows
       WHERE id = ? AND organization_id = ? AND entity_type = ? AND is_active = 1
       FOR UPDATE`,
      [workflowId, organizationId, entityType]
    );
    if (!workflows.length) {
      const error = new Error("Approval workflow not found or inactive");
      error.statusCode = 404;
      throw error;
    }
    await assertEntityOwnership(connection, entityType, entityId, organizationId);
    const [steps] = await connection.execute(
      `SELECT step_order FROM approval_workflow_steps
       WHERE approval_workflow_id = ? ORDER BY step_order ASC LIMIT 1`,
      [workflowId]
    );
    if (!steps.length) {
      const error = new Error("Approval workflow has no steps");
      error.statusCode = 400;
      throw error;
    }
    const [result] = await connection.execute(
      `INSERT INTO approval_requests
       (approval_workflow_id, organization_id, entity_type, entity_id, current_step, status, requested_by)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
      [workflowId, organizationId, entityType, entityId, steps[0].step_order, requestedBy]
    );
    await connection.commit();
    return getApprovalRequest(result.insertId, organizationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getApprovalRequest(id, organizationId) {
  const [rows] = await pool.execute(
    `SELECT ar.id, ar.approval_workflow_id, ar.organization_id, ar.entity_type,
       ar.entity_id, ar.current_step, ar.status, ar.requested_by,
       ar.completed_at, ar.created_at, ar.updated_at,
       aw.name AS workflow_name
     FROM approval_requests ar
     INNER JOIN approval_workflows aw ON aw.id = ar.approval_workflow_id
     WHERE ar.id = ? AND ar.organization_id = ? LIMIT 1`,
    [id, organizationId]
  );
  if (!rows[0]) return null;
  const [actions] = await pool.execute(
    `SELECT id, approval_request_id, step_order, approver_id, action, comments, action_at
     FROM approval_actions
     WHERE approval_request_id = ? ORDER BY step_order ASC, action_at ASC, id ASC`,
    [id]
  );
  return { ...rows[0], actions };
}

export async function decideApprovalRequest({ requestId, organizationId, userId, roleId, stepOrder, decision, comments }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [requests] = await connection.execute(
      `SELECT id, approval_workflow_id, current_step, status, requested_by
       FROM approval_requests
       WHERE id = ? AND organization_id = ? FOR UPDATE`,
      [requestId, organizationId]
    );
    const request = requests[0];
    if (!request) {
      const error = new Error("Approval request not found");
      error.statusCode = 404;
      throw error;
    }
    if (request.status !== "PENDING") {
      const error = new Error("Approval request is already complete");
      error.statusCode = 409;
      throw error;
    }
    if (Number(request.current_step) !== Number(stepOrder)) {
      const error = new Error("Approval step is stale or has already been decided");
      error.statusCode = 409;
      throw error;
    }
    if (Number(request.requested_by) === Number(userId)) {
      const error = new Error("You cannot approve or reject your own request");
      error.statusCode = 403;
      throw error;
    }
    const [steps] = await connection.execute(
      `SELECT id, step_order, approver_role_id
       FROM approval_workflow_steps
       WHERE approval_workflow_id = ? AND step_order = ? LIMIT 1`,
      [request.approval_workflow_id, request.current_step]
    );
    if (!steps[0]) {
      const error = new Error("Current approval step is not configured");
      error.statusCode = 409;
      throw error;
    }
    if (steps[0].approver_role_id == null || Number(steps[0].approver_role_id) !== Number(roleId)) {
      const error = new Error("Your role cannot decide this approval step");
      error.statusCode = 403;
      throw error;
    }
    const [priorActions] = await connection.execute(
      `SELECT id FROM approval_actions
       WHERE approval_request_id = ? AND step_order = ? LIMIT 1`,
      [requestId, request.current_step]
    );
    if (priorActions.length) {
      const error = new Error("This approval step already has a decision");
      error.statusCode = 409;
      throw error;
    }
    await connection.execute(
      `INSERT INTO approval_actions
       (approval_request_id, step_order, approver_id, action, comments)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, request.current_step, userId, decision, comments ?? null]
    );

    if (decision === "REJECTED") {
      await connection.execute(
        `UPDATE approval_requests SET status = 'REJECTED', completed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ? AND status = 'PENDING'`,
        [requestId, organizationId]
      );
    } else {
      const [nextSteps] = await connection.execute(
        `SELECT step_order FROM approval_workflow_steps
         WHERE approval_workflow_id = ? AND step_order > ? ORDER BY step_order ASC LIMIT 1`,
        [request.approval_workflow_id, request.current_step]
      );
      if (nextSteps.length) {
        await connection.execute(
          `UPDATE approval_requests SET current_step = ?
           WHERE id = ? AND organization_id = ? AND status = 'PENDING'`,
          [nextSteps[0].step_order, requestId, organizationId]
        );
      } else {
        await connection.execute(
          `UPDATE approval_requests SET status = 'APPROVED', completed_at = CURRENT_TIMESTAMP
           WHERE id = ? AND organization_id = ? AND status = 'PENDING'`,
          [requestId, organizationId]
        );
      }
    }
    await connection.commit();
    return getApprovalRequest(requestId, organizationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
