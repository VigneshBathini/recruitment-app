import pool from "../config/database.js";
import { canTransitionOnboardingStatus, canTransitionOnboardingTaskStatus } from "../schemas/onboarding.schema.js";

const onboardingSelect = `SELECT ob.id, ob.organization_id, ob.offer_id, ob.application_id,
       ob.candidate_id, ob.status, ob.target_join_date, ob.initiated_by, ob.initiated_at,
       ob.completed_at, ob.notes, ob.created_at, ob.updated_at,
       c.first_name AS candidate_first_name, c.last_name AS candidate_last_name,
       c.email AS candidate_email, o.annual_ctc, o.currency, o.employment_type,
       a.job_id, j.title AS job_title
     FROM onboarding_records ob
     INNER JOIN offers o ON o.id = ob.offer_id AND o.organization_id = ob.organization_id
     INNER JOIN applications a ON a.id = ob.application_id AND a.organization_id = ob.organization_id
     INNER JOIN candidates c ON c.id = ob.candidate_id AND c.organization_id = ob.organization_id
     INNER JOIN jobs j ON j.id = a.job_id AND j.organization_id = a.organization_id`;

export async function getOnboardingDashboard(organizationId) {
  const [[statusRows], [taskRows], [documentRows]] = await Promise.all([
    pool.execute(
      `SELECT status, COUNT(*) AS count FROM onboarding_records
       WHERE organization_id = ? GROUP BY status`, [organizationId],
    ),
    pool.execute(
      `SELECT t.status, COUNT(*) AS count
       FROM onboarding_tasks t WHERE t.organization_id = ? GROUP BY t.status`, [organizationId],
    ),
    pool.execute(
      `SELECT d.review_status, COUNT(*) AS count
       FROM candidate_documents d WHERE d.organization_id = ? AND d.onboarding_id IS NOT NULL
       GROUP BY d.review_status`, [organizationId],
    ),
  ]);
  const counts = (rows) => Object.fromEntries(rows.map((row) => [row.status ?? row.review_status, Number(row.count)]));
  const onboarding = counts(statusRows);
  return {
    total: Object.values(onboarding).reduce((sum, value) => sum + value, 0),
    onboarding_by_status: onboarding,
    tasks_by_status: counts(taskRows),
    documents_by_review_status: counts(documentRows),
  };
}

export async function listOnboardingRecords({ organizationId, search, status, candidateId }) {
  const filters = ["ob.organization_id = ?"];
  const values = [organizationId];
  if (candidateId != null) { filters.push("ob.candidate_id = ?"); values.push(candidateId); }
  if (status) { filters.push("ob.status = ?"); values.push(status); }
  if (search) {
    filters.push("(c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR j.title LIKE ? OR CAST(ob.offer_id AS CHAR) LIKE ? OR CAST(ob.application_id AS CHAR) LIKE ?)");
    const term = `%${search}%`;
    values.push(term, term, term, term, term, term);
  }
  const [rows] = await pool.execute(
    `${onboardingSelect} WHERE ${filters.join(" AND ")} ORDER BY ob.created_at DESC, ob.id DESC`, values,
  );
  return rows;
}

export async function getOnboardingRecord(id, organizationId, candidateId = null) {
  const filters = ["ob.id = ?", "ob.organization_id = ?"];
  const values = [id, organizationId];
  if (candidateId != null) { filters.push("ob.candidate_id = ?"); values.push(candidateId); }
  const [rows] = await pool.execute(`${onboardingSelect} WHERE ${filters.join(" AND ")} LIMIT 1`, values);
  return rows[0] ?? null;
}

export async function listOnboardingHistory(onboardingId, organizationId) {
  const [rows] = await pool.execute(
    `SELECT h.id, h.entity_type, h.entity_id, h.action, h.field_name,
       h.previous_value, h.new_value, h.actor_type, h.created_at,
       CASE WHEN h.actor_type = 'CANDIDATE' THEN CONCAT_WS(' ', c.first_name, c.last_name)
            ELSE CONCAT_WS(' ', u.first_name, u.last_name) END AS actor_name
     FROM workflow_history h
     JOIN onboarding_records ob ON ob.id = ? AND ob.organization_id = h.organization_id
     LEFT JOIN users u ON h.actor_type = 'MANAGEMENT_USER' AND u.id = h.actor_id AND u.organization_id = h.organization_id
     LEFT JOIN candidates c ON h.actor_type = 'CANDIDATE' AND c.id = h.actor_id AND c.organization_id = h.organization_id
     WHERE h.organization_id = ? AND (
       (h.entity_type = 'ONBOARDING' AND h.entity_id = ob.id) OR
       (h.entity_type = 'ONBOARDING_TASK' AND EXISTS (
         SELECT 1 FROM onboarding_tasks t WHERE t.id = h.entity_id
           AND t.onboarding_id = ob.id AND t.organization_id = ob.organization_id
       ))
     ) ORDER BY h.created_at ASC, h.id ASC`,
    [onboardingId, organizationId],
  );
  return rows;
}

export async function createOnboardingRecord({ organizationId, offerId, userId, targetJoinDate, notes }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [offers] = await connection.execute(
      `SELECT o.id, o.status, o.application_id, o.start_date, a.candidate_id
       FROM offers o
       INNER JOIN applications a ON a.id = o.application_id AND a.organization_id = o.organization_id
       INNER JOIN candidates c ON c.id = a.candidate_id AND c.organization_id = a.organization_id
       WHERE o.id = ? AND o.organization_id = ? FOR UPDATE`,
      [offerId, organizationId],
    );
    const offer = offers[0];
    if (!offer) { await connection.rollback(); return { error: "offer_not_found" }; }
    if (offer.status !== "ACCEPTED") { await connection.rollback(); return { error: "offer_not_accepted" }; }
    const [existing] = await connection.execute(
      `SELECT id FROM onboarding_records WHERE organization_id = ? AND offer_id = ? LIMIT 1 FOR UPDATE`,
      [organizationId, offerId],
    );
    if (existing.length) { await connection.rollback(); return { error: "duplicate" }; }
    const [result] = await connection.execute(
      `INSERT INTO onboarding_records
       (organization_id, offer_id, application_id, candidate_id, status, target_join_date, initiated_by, notes)
       VALUES (?, ?, ?, ?, 'INITIATED', ?, ?, ?)`,
      [organizationId, offerId, offer.application_id, offer.candidate_id, targetJoinDate ?? offer.start_date, userId, notes ?? null],
    );
    await connection.execute(
      `INSERT INTO workflow_history
       (organization_id, entity_type, entity_id, action, field_name, previous_value, new_value, actor_type, actor_id)
       VALUES (?, 'ONBOARDING', ?, 'CREATED', 'status', NULL, 'INITIATED', 'MANAGEMENT_USER', ?)`,
      [organizationId, result.insertId, userId],
    );
    await connection.commit();
    return { id: result.insertId };
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") return { error: "duplicate" };
    throw error;
  } finally { connection.release(); }
}

export async function updateOnboardingRecord(id, organizationId, changes) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT id, status FROM onboarding_records WHERE id = ? AND organization_id = ? FOR UPDATE`,
      [id, organizationId],
    );
    const record = rows[0];
    if (!record) { await connection.rollback(); return { error: "not_found" }; }
    if (changes.status && record.status !== changes.status) {
      if (!canTransitionOnboardingStatus(record.status, changes.status)) {
        await connection.rollback();
        return { error: "invalid_transition" };
      }
      await connection.execute(
        `INSERT INTO workflow_history
         (organization_id, entity_type, entity_id, action, field_name, previous_value, new_value, actor_type, actor_id)
         VALUES (?, 'ONBOARDING', ?, 'STATUS_CHANGED', 'status', ?, ?, 'MANAGEMENT_USER', ?)`,
        [organizationId, id, record.status, changes.status, changes.actorId],
      );
    }
    const fields = [];
    const values = [];
    for (const [key, column] of [["status", "status"], ["target_join_date", "target_join_date"], ["notes", "notes"]]) {
      if (Object.hasOwn(changes, key)) { fields.push(`${column} = ?`); values.push(changes[key] ?? null); }
    }
    if (changes.status === "COMPLETED" && record.status !== "COMPLETED") fields.push("completed_at = CURRENT_TIMESTAMP");
    else if (changes.status && changes.status !== "COMPLETED") fields.push("completed_at = NULL");
    await connection.execute(
      `UPDATE onboarding_records SET ${fields.join(", ")} WHERE id = ? AND organization_id = ?`,
      [...values, id, organizationId],
    );
    await connection.commit();
    return {};
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function completeOnboardingAndHire(id, organizationId, userId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT ob.id AS onboarding_id, ob.organization_id, ob.application_id,
         ob.status AS onboarding_status,
         a.status AS application_status, a.current_stage AS application_stage, a.decision,
         o.status AS offer_status
       FROM onboarding_records ob
       INNER JOIN applications a ON a.id = ob.application_id AND a.organization_id = ob.organization_id
       INNER JOIN offers o ON o.id = ob.offer_id AND o.application_id = a.id AND o.organization_id = ob.organization_id
       WHERE ob.id = ? AND ob.organization_id = ?
       FOR UPDATE`,
      [id, organizationId],
    );
    const record = rows[0];
    if (!record) { await connection.rollback(); return { error: "not_found" }; }
    if (record.decision !== "SELECTED") { await connection.rollback(); return { error: "not_selected" }; }
    if (record.offer_status !== "ACCEPTED") { await connection.rollback(); return { error: "offer_not_accepted" }; }
    const isLegacyCompleted = record.onboarding_status === "COMPLETED" && record.application_status !== "HIRED";
    if (record.onboarding_status !== "READY_TO_JOIN" && !isLegacyCompleted) {
      await connection.rollback(); return { error: "invalid_onboarding_status" };
    }
    if (record.application_status === "HIRED") { await connection.rollback(); return { error: "already_hired" }; }

    const [applicationUpdate] = await connection.execute(
      `UPDATE applications SET status = 'HIRED', current_stage = 'HIRED'
       WHERE id = ? AND organization_id = ? AND status = ? AND decision = 'SELECTED'`,
      [record.application_id, organizationId, record.application_status],
    );
    if (applicationUpdate.affectedRows !== 1) {
      await connection.rollback(); return { error: "already_hired" };
    }
    await connection.execute(
      `INSERT INTO application_status_history
       (application_id, from_status, to_status, changed_by, actor_type, actor_id)
       VALUES (?, ?, 'HIRED', ?, 'MANAGEMENT_USER', ?)`,
      [record.application_id, record.application_status, userId, userId],
    );
    if (record.application_stage !== "HIRED") {
      await connection.execute(
        `INSERT INTO workflow_history
         (organization_id, entity_type, entity_id, action, field_name, previous_value, new_value, actor_type, actor_id, reason)
         VALUES (?, 'APPLICATION', ?, 'STAGE_CHANGED', 'current_stage', ?, 'HIRED', 'MANAGEMENT_USER', ?, NULL)`,
        [organizationId, record.application_id, record.application_stage, userId],
      );
    }
    const [onboardingUpdate] = await connection.execute(
      `UPDATE onboarding_records SET status = 'COMPLETED', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
       WHERE id = ? AND organization_id = ? AND status IN ('READY_TO_JOIN', 'COMPLETED')`,
      [record.onboarding_id, organizationId],
    );
    if (onboardingUpdate.affectedRows !== 1) throw new Error("Unable to complete onboarding record");
    if (record.onboarding_status !== "COMPLETED") {
      await connection.execute(
        `INSERT INTO workflow_history
         (organization_id, entity_type, entity_id, action, field_name, previous_value, new_value, actor_type, actor_id)
         VALUES (?, 'ONBOARDING', ?, 'STATUS_CHANGED', 'status', ?, 'COMPLETED', 'MANAGEMENT_USER', ?)`,
        [organizationId, record.onboarding_id, record.onboarding_status, userId],
      );
    }

    const [onboardingRows] = await connection.execute(
      `${onboardingSelect} WHERE ob.id = ? AND ob.organization_id = ? LIMIT 1`,
      [record.onboarding_id, organizationId],
    );
    if (!onboardingRows[0]) throw new Error("Unable to load the completed onboarding record");
    await connection.commit();
    return { onboarding: onboardingRows[0] };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function listOnboardingTasks(onboardingId, organizationId, candidateId = null) {
  const filters = ["t.onboarding_id = ?", "t.organization_id = ?"];
  const values = [onboardingId, organizationId];
  if (candidateId != null) { filters.push("t.assigned_to_candidate_id = ?"); values.push(candidateId); }
  const [rows] = await pool.execute(
    `SELECT t.*, CONCAT_WS(' ', cu.first_name, cu.last_name) AS candidate_assignee_name,
       CONCAT_WS(' ', u.first_name, u.last_name) AS employee_assignee_name
     FROM onboarding_tasks t
     LEFT JOIN candidates cu ON cu.id = t.assigned_to_candidate_id AND cu.organization_id = t.organization_id
     LEFT JOIN users u ON u.id = t.assigned_to_user_id AND u.organization_id = t.organization_id
     WHERE ${filters.join(" AND ")} ORDER BY t.due_date IS NULL, t.due_date, t.id`, values,
  );
  return rows;
}

export async function createOnboardingTask(onboardingId, organizationId, data, actorId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [records] = await connection.execute(
      `SELECT candidate_id FROM onboarding_records WHERE id = ? AND organization_id = ? FOR UPDATE`,
      [onboardingId, organizationId],
    );
    if (!records[0]) { await connection.rollback(); return { error: "onboarding_not_found" }; }
    if (data.assigned_to_candidate_id != null) {
      const [candidates] = await connection.execute(
        `SELECT id FROM candidates WHERE id = ? AND organization_id = ? AND is_active = 1`,
        [data.assigned_to_candidate_id, organizationId],
      );
      if (!candidates.length || Number(data.assigned_to_candidate_id) !== Number(records[0].candidate_id)) {
        await connection.rollback(); return { error: "invalid_candidate_assignee" };
      }
    }
    if (data.assigned_to_user_id != null) {
      const [users] = await connection.execute(
        `SELECT u.id FROM users u
         INNER JOIN organization_role_permissions orp
           ON orp.organization_id = u.organization_id AND orp.role_id = u.role_id
         INNER JOIN permissions p ON p.id = orp.permission_id AND p.name = 'onboarding.manage'
         WHERE u.id = ? AND u.organization_id = ? AND u.is_active = 1 LIMIT 1`,
        [data.assigned_to_user_id, organizationId],
      );
      if (!users.length) { await connection.rollback(); return { error: "invalid_user_assignee" }; }
    }
    const [result] = await connection.execute(
      `INSERT INTO onboarding_tasks
       (organization_id, onboarding_id, title, description, assigned_to_candidate_id, assigned_to_user_id, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [organizationId, onboardingId, data.title, data.description ?? null,
        data.assigned_to_candidate_id ?? null, data.assigned_to_user_id ?? null, data.due_date ?? null],
    );
    await connection.execute(
      `INSERT INTO workflow_history
       (organization_id, entity_type, entity_id, action, field_name, previous_value, new_value, actor_type, actor_id)
       VALUES (?, 'ONBOARDING_TASK', ?, 'CREATED', 'status', NULL, 'PENDING', 'MANAGEMENT_USER', ?)`,
      [organizationId, result.insertId, actorId],
    );
    await connection.commit();
    return { id: result.insertId };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function updateOnboardingTask(taskId, organizationId, changes, actor) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT t.*, ob.candidate_id FROM onboarding_tasks t
       JOIN onboarding_records ob ON ob.id = t.onboarding_id AND ob.organization_id = t.organization_id
       WHERE t.id = ? AND t.organization_id = ? FOR UPDATE`,
      [taskId, organizationId],
    );
    const task = rows[0];
    if (!task || (actor.candidateId != null && Number(task.assigned_to_candidate_id) !== Number(actor.candidateId))) {
      await connection.rollback(); return { error: "not_found" };
    }
    if (actor.candidateId != null && Object.keys(changes).some((key) => !["status", "comments"].includes(key))) {
      await connection.rollback(); return { error: "forbidden" };
    }
    if (changes.status && task.status !== changes.status && !canTransitionOnboardingTaskStatus(task.status, changes.status)) {
      await connection.rollback(); return { error: "invalid_transition" };
    }
    if (changes.status && task.status !== changes.status) {
      const actorType = actor.candidateId != null ? "CANDIDATE" : "MANAGEMENT_USER";
      const actorId = actor.candidateId ?? actor.userId;
      await connection.execute(
        `INSERT INTO workflow_history
         (organization_id, entity_type, entity_id, action, field_name, previous_value, new_value, actor_type, actor_id)
         VALUES (?, 'ONBOARDING_TASK', ?, 'STATUS_CHANGED', 'status', ?, ?, ?, ?)`,
        [organizationId, taskId, task.status, changes.status, actorType, actorId],
      );
    }
    const candidateAssignee = Object.hasOwn(changes, "assigned_to_candidate_id") ? changes.assigned_to_candidate_id : task.assigned_to_candidate_id;
    const userAssignee = Object.hasOwn(changes, "assigned_to_user_id") ? changes.assigned_to_user_id : task.assigned_to_user_id;
    if (candidateAssignee != null && userAssignee != null) { await connection.rollback(); return { error: "dual_assignment" }; }
    if (changes.assigned_to_candidate_id != null) {
      const [candidates] = await connection.execute(
        `SELECT id FROM candidates WHERE id = ? AND organization_id = ? AND is_active = 1`,
        [changes.assigned_to_candidate_id, organizationId],
      );
      if (!candidates.length || Number(changes.assigned_to_candidate_id) !== Number(task.candidate_id)) {
        await connection.rollback(); return { error: "invalid_candidate_assignee" };
      }
    }
    if (changes.assigned_to_user_id != null) {
      const [users] = await connection.execute(
        `SELECT u.id FROM users u
         INNER JOIN organization_role_permissions orp
           ON orp.organization_id = u.organization_id AND orp.role_id = u.role_id
         INNER JOIN permissions p ON p.id = orp.permission_id AND p.name = 'onboarding.manage'
         WHERE u.id = ? AND u.organization_id = ? AND u.is_active = 1 LIMIT 1`,
        [changes.assigned_to_user_id, organizationId],
      );
      if (!users.length) { await connection.rollback(); return { error: "invalid_user_assignee" }; }
    }
    const fields = [];
    const values = [];
    for (const [key, column] of [["title", "title"], ["description", "description"], ["assigned_to_candidate_id", "assigned_to_candidate_id"], ["assigned_to_user_id", "assigned_to_user_id"], ["status", "status"], ["due_date", "due_date"], ["comments", "comments"]]) {
      if (Object.hasOwn(changes, key)) { fields.push(`${column} = ?`); values.push(changes[key] ?? null); }
    }
    if (changes.status === "COMPLETED" && task.status !== "COMPLETED") {
      fields.push("completed_at = CURRENT_TIMESTAMP");
      if (actor.userId != null) { fields.push("completed_by_user_id = ?"); values.push(actor.userId); }
    } else if (changes.status && changes.status !== "COMPLETED") {
      fields.push("completed_at = NULL", "completed_by_user_id = NULL");
    }
    await connection.execute(`UPDATE onboarding_tasks SET ${fields.join(", ")} WHERE id = ? AND organization_id = ?`, [...values, taskId, organizationId]);
    const onboardingId = Number(task.onboarding_id);
    await connection.commit();
    return { onboardingId };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function listOnboardingDocuments(onboardingId, organizationId, candidateId = null) {
  const filters = ["d.onboarding_id = ?", "d.organization_id = ?"];
  const values = [onboardingId, organizationId];
  if (candidateId != null) { filters.push("d.candidate_id = ?"); values.push(candidateId); }
  const [rows] = await pool.execute(
    `SELECT d.id, d.organization_id, d.candidate_id, d.onboarding_id, d.document_type,
       d.file_name, d.file_url AS storage_key, d.mime_type, d.file_size, d.is_primary,
       d.uploaded_at, d.review_status, d.reviewed_by, d.reviewed_at, d.rejection_reason,
       CONCAT_WS(' ', u.first_name, u.last_name) AS reviewer_name
     FROM candidate_documents d
     LEFT JOIN users u ON u.id = d.reviewed_by AND u.organization_id = d.organization_id
     WHERE ${filters.join(" AND ")} ORDER BY d.document_type, d.is_primary DESC, d.uploaded_at DESC`, values,
  );
  return rows;
}

export async function createCandidateDocument({ onboardingId, organizationId, candidateId, documentType, fileName, storageKey, mimeType, fileSize }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [records] = await connection.execute(
      `SELECT id FROM onboarding_records WHERE id = ? AND organization_id = ? AND candidate_id = ? FOR UPDATE`,
      [onboardingId, organizationId, candidateId],
    );
    if (!records.length) { await connection.rollback(); return { error: "not_found" }; }
    await connection.execute(
      `UPDATE candidate_documents SET is_primary = 0
       WHERE organization_id = ? AND candidate_id = ? AND onboarding_id = ? AND document_type = ? AND is_primary = 1`,
      [organizationId, candidateId, onboardingId, documentType],
    );
    const [result] = await connection.execute(
      `INSERT INTO candidate_documents
       (organization_id, candidate_id, onboarding_id, document_type, file_name, file_url, mime_type, file_size, is_primary, review_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'PENDING')`,
      [organizationId, candidateId, onboardingId, documentType, fileName, storageKey, mimeType, fileSize],
    );
    await connection.commit();
    return { id: result.insertId };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function reviewCandidateDocument(documentId, organizationId, userId, reviewStatus, reason) {
  const [result] = await pool.execute(
    `UPDATE candidate_documents d
     INNER JOIN onboarding_records ob ON ob.id = d.onboarding_id AND ob.organization_id = d.organization_id
     SET d.review_status = ?, d.reviewed_by = ?, d.reviewed_at = CURRENT_TIMESTAMP, d.rejection_reason = ?
     WHERE d.id = ? AND d.organization_id = ? AND d.onboarding_id IS NOT NULL
       AND d.review_status IN ('PENDING', 'REJECTED')`,
    [reviewStatus, userId, reviewStatus === "REJECTED" ? reason : null, documentId, organizationId],
  );
  return result.affectedRows > 0;
}

export async function getOnboardingDocumentStorage(documentId, organizationId, candidateId = null) {
  const filters = ["d.id = ?", "d.organization_id = ?", "d.onboarding_id IS NOT NULL"];
  const values = [documentId, organizationId];
  if (candidateId != null) { filters.push("d.candidate_id = ?"); values.push(candidateId); }
  const [rows] = await pool.execute(
    `SELECT d.id, d.organization_id, d.candidate_id, d.onboarding_id, d.document_type,
       d.file_url AS storage_key, d.file_name, d.mime_type, d.file_size, d.is_primary,
       d.uploaded_at, d.review_status, d.reviewed_by, d.reviewed_at, d.rejection_reason,
       CONCAT_WS(' ', u.first_name, u.last_name) AS reviewer_name
     FROM candidate_documents d INNER JOIN onboarding_records ob
       ON ob.id = d.onboarding_id AND ob.organization_id = d.organization_id
     LEFT JOIN users u ON u.id = d.reviewed_by AND u.organization_id = d.organization_id
     WHERE ${filters.join(" AND ")} LIMIT 1`, values,
  );
  return rows[0] ?? null;
}
