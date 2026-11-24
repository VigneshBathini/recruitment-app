import pool from "../config/database.js";

const candidateOfferSelect = `SELECT o.id, o.organization_id, o.application_id, o.annual_ctc,
       o.currency, o.employment_type, o.work_location, o.start_date, o.expiry_date,
       o.offer_letter_url,
       CASE WHEN o.status = 'ISSUED' AND o.expiry_date IS NOT NULL AND o.expiry_date < CURRENT_DATE
         THEN 'EXPIRED' ELSE o.status END AS status,
       o.issued_at, o.candidate_responded_at,
       o.candidate_response_comments, j.id AS job_id, j.title AS job_title
     FROM offers o
     INNER JOIN applications a
       ON a.id = o.application_id AND a.organization_id = o.organization_id
     INNER JOIN jobs j
       ON j.id = a.job_id AND j.organization_id = a.organization_id`;

const candidateVisibleStatuses = "('ISSUED', 'ACCEPTED', 'DECLINED')";

export async function listCandidateOffers(candidateId, organizationId) {
  const [rows] = await pool.execute(
    `${candidateOfferSelect}
     WHERE a.candidate_id = ? AND o.organization_id = ?
       AND o.status IN ${candidateVisibleStatuses}
     ORDER BY o.issued_at DESC, o.id DESC`,
    [candidateId, organizationId],
  );
  return rows;
}

export async function getCandidateOffer(id, candidateId, organizationId) {
  const [rows] = await pool.execute(
    `${candidateOfferSelect}
     WHERE o.id = ? AND a.candidate_id = ? AND o.organization_id = ?
       AND o.status IN ${candidateVisibleStatuses}
     LIMIT 1`,
    [id, candidateId, organizationId],
  );
  return rows[0] ?? null;
}

export async function respondToCandidateOffer(id, candidateId, organizationId, status, comments) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT o.id, o.status, o.candidate_responded_at, a.status AS application_status,
         (o.expiry_date IS NOT NULL AND o.expiry_date < CURRENT_DATE) AS expired
       FROM offers o
       INNER JOIN applications a
         ON a.id = o.application_id AND a.organization_id = o.organization_id
       WHERE o.id = ? AND o.organization_id = ? AND a.candidate_id = ?
       FOR UPDATE`,
      [id, organizationId, candidateId],
    );
    const offer = rows[0];
    if (!offer) {
      await connection.rollback();
      return { error: "not_found" };
    }
    if (offer.application_status === "WITHDRAWN") {
      await connection.rollback();
      return { error: "application_withdrawn" };
    }
    if (offer.status !== "ISSUED" || offer.candidate_responded_at) {
      await connection.rollback();
      return { error: "already_responded" };
    }
    if (Number(offer.expired)) {
      await connection.rollback();
      return { error: "expired" };
    }

    const [result] = await connection.execute(
      `UPDATE offers
       SET status = ?, candidate_responded_at = CURRENT_TIMESTAMP,
           candidate_response_comments = ?
       WHERE id = ? AND organization_id = ? AND status = 'ISSUED'
         AND candidate_responded_at IS NULL
         AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
         AND EXISTS (SELECT 1 FROM applications a WHERE a.id = offers.application_id
           AND a.organization_id = offers.organization_id AND a.status <> 'WITHDRAWN')`,
      [status, comments ?? null, id, organizationId],
    );
    if (result.affectedRows !== 1) {
      const [latestRows] = await connection.execute(
        `SELECT (o.expiry_date IS NOT NULL AND o.expiry_date < CURRENT_DATE) AS expired,
           a.status AS application_status
         FROM offers o INNER JOIN applications a ON a.id = o.application_id AND a.organization_id = o.organization_id
         WHERE o.id = ? AND o.organization_id = ? FOR UPDATE`,
        [id, organizationId],
      );
      await connection.rollback();
      if (latestRows[0]?.application_status === "WITHDRAWN") return { error: "application_withdrawn" };
      return Number(latestRows[0]?.expired) ? { error: "expired" } : { error: "already_responded" };
    }

    await connection.commit();
    return { offer: await getCandidateOffer(id, candidateId, organizationId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
