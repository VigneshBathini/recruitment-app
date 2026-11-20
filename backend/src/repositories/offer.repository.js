import pool from "../config/database.js";

const offerDetailsSelect = `SELECT o.*, a.candidate_id, a.job_id, a.status AS application_status,
       a.decision AS application_decision, a.current_stage,
       c.first_name AS candidate_first_name, c.last_name AS candidate_last_name, c.email AS candidate_email,
       j.title AS job_title
     FROM offers o
     JOIN applications a ON a.id = o.application_id AND a.organization_id = o.organization_id
     JOIN candidates c ON c.id = a.candidate_id AND c.organization_id = a.organization_id
     JOIN jobs j ON j.id = a.job_id AND j.organization_id = a.organization_id`;

export async function listOffers({ organizationId, search, status }) {
  const filters = ["o.organization_id = ?"];
  const values = [organizationId];
  if (status) { filters.push("o.status = ?"); values.push(status); }
  if (search) {
    filters.push("(c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR j.title LIKE ? OR CAST(o.application_id AS CHAR) LIKE ?)");
    const term = `%${search}%`;
    values.push(term, term, term, term, term);
  }
  const [rows] = await pool.execute(
    `${offerDetailsSelect} WHERE ${filters.join(" AND ")} ORDER BY o.created_at DESC, o.id DESC`,
    values,
  );
  return rows;
}

export async function getOfferById(id, organizationId) {
  const [rows] = await pool.execute(
    `${offerDetailsSelect} WHERE o.id = ? AND o.organization_id = ? LIMIT 1`,
    [id, organizationId],
  );
  return rows[0] ?? null;
}

export async function getOfferApprovalHistory(id, organizationId) {
  const [requests] = await pool.execute(
    `SELECT ar.id, ar.approval_workflow_id, ar.status, ar.current_step, ar.requested_by,
       ar.completed_at, ar.created_at, ar.updated_at, aw.name AS workflow_name
     FROM approval_requests ar
     JOIN approval_workflows aw ON aw.id = ar.approval_workflow_id
     WHERE ar.organization_id = ? AND ar.entity_type = 'OFFER' AND ar.entity_id = ?
     ORDER BY ar.created_at DESC, ar.id DESC`,
    [organizationId, id],
  );
  if (!requests.length) return [];
  const ids = requests.map((request) => request.id);
  const [actions] = await pool.execute(
    `SELECT aa.id, aa.approval_request_id, aa.step_order, aa.approver_id,
       CONCAT_WS(' ', u.first_name, u.last_name) AS approver_name,
       aa.action, aa.comments, aa.action_at
     FROM approval_actions aa
     JOIN approval_requests ar ON ar.id = aa.approval_request_id AND ar.organization_id = ?
     LEFT JOIN users u ON u.id = aa.approver_id AND u.organization_id = ar.organization_id
     WHERE aa.approval_request_id IN (${ids.map(() => "?").join(", ")})
     ORDER BY aa.step_order, aa.action_at, aa.id`,
    [organizationId, ...ids],
  );
  return requests.map((request) => ({
    ...request,
    actions: actions.filter((action) => Number(action.approval_request_id) === Number(request.id)),
  }));
}

export async function createOffer({ organizationId, applicationId, createdBy, terms }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [applications] = await connection.execute(
      `SELECT id, decision FROM applications
       WHERE id = ? AND organization_id = ? FOR UPDATE`,
      [applicationId, organizationId],
    );
    if (!applications[0]) {
      const error = new Error("Application not found in this organization"); error.statusCode = 404; throw error;
    }
    if (applications[0].decision !== "SELECTED") {
      const error = new Error("An offer can only be created for a SELECTED application"); error.statusCode = 409; throw error;
    }
    const [activeOffers] = await connection.execute(
      `SELECT id FROM offers
       WHERE organization_id = ? AND application_id = ?
         AND status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED')
       LIMIT 1 FOR UPDATE`,
      [organizationId, applicationId],
    );
    if (activeOffers.length) {
      const error = new Error("An active offer already exists for this application"); error.statusCode = 409; throw error;
    }
    const [result] = await connection.execute(
      `INSERT INTO offers
       (organization_id, application_id, annual_ctc, currency, employment_type, work_location,
        start_date, expiry_date, offer_letter_url, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
      [organizationId, applicationId, terms.annual_ctc, terms.currency, terms.employment_type,
        terms.work_location, terms.start_date, terms.expiry_date, terms.offer_letter_url, createdBy],
    );
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateOffer(id, organizationId, terms) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT id, status, annual_ctc, currency, employment_type, work_location,
         start_date, expiry_date, offer_letter_url
       FROM offers WHERE id = ? AND organization_id = ? FOR UPDATE`,
      [id, organizationId],
    );
    const offer = rows[0];
    if (!offer) { await connection.rollback(); return null; }
    if (!["DRAFT", "REJECTED"].includes(offer.status)) {
      const error = new Error("Only DRAFT or REJECTED offers can be edited"); error.statusCode = 409; throw error;
    }
    const merged = { ...offer, ...terms };
    if (new Date(merged.expiry_date) <= new Date(merged.start_date)) {
      const error = new Error("expiry_date must be later than start_date"); error.statusCode = 400; throw error;
    }
    await connection.execute(
      `UPDATE offers SET annual_ctc = ?, currency = ?, employment_type = ?, work_location = ?,
         start_date = ?, expiry_date = ?, offer_letter_url = ?
       WHERE id = ? AND organization_id = ? AND status IN ('DRAFT', 'REJECTED')`,
      [merged.annual_ctc, merged.currency, merged.employment_type, merged.work_location,
        merged.start_date, merged.expiry_date, merged.offer_letter_url, id, organizationId],
    );
    await connection.commit();
    return getOfferById(id, organizationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function issueOffer(id, organizationId, userId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT id, status FROM offers WHERE id = ? AND organization_id = ? FOR UPDATE`,
      [id, organizationId],
    );
    if (!rows[0]) { await connection.rollback(); return null; }
    if (rows[0].status !== "APPROVED") {
      const error = new Error("Only approved offers can be issued"); error.statusCode = 409; throw error;
    }
    await connection.execute(
      `UPDATE offers SET status = 'ISSUED', issued_by = ?, issued_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ? AND status = 'APPROVED'`,
      [userId, id, organizationId],
    );
    await connection.commit();
    return getOfferById(id, organizationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
