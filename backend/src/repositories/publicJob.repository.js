import pool from "../config/database.js";

const candidateJobFields = `j.id, j.title, j.jd_content, j.published_at`;

export async function getPublishedJobsByOrganizationSlug(organizationSlug) {
  const [rows] = await pool.execute(
    `SELECT o.id AS organization_id, ${candidateJobFields}
     FROM organizations o
     LEFT JOIN jobs j
       ON j.organization_id = o.id AND j.status = 'PUBLISHED'
     WHERE o.slug = ? AND o.is_active = 1
     ORDER BY j.published_at DESC, j.id DESC`,
    [organizationSlug]
  );

  if (!rows.length) return null;
  return rows
    .filter((row) => row.id != null)
    .map(({ id, title, jd_content, published_at }) => ({
      id,
      title,
      jd_content,
      published_at,
    }));
}

export async function getPublishedJobByOrganizationSlug(organizationSlug, jobId) {
  const [rows] = await pool.execute(
    `SELECT ${candidateJobFields}
     FROM organizations o
     INNER JOIN jobs j ON j.organization_id = o.id
     WHERE o.slug = ? AND o.is_active = 1
       AND j.id = ? AND j.status = 'PUBLISHED'
     LIMIT 1`,
    [organizationSlug, jobId]
  );
  return rows[0] ?? null;
}
