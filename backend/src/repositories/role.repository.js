import pool from "../config/database.js";

export async function getAllRoles() {
  const [rows] = await pool.execute(
    `SELECT
       id,
       name,
       description
     FROM roles
     ORDER BY name ASC`
  );

  return rows;
}