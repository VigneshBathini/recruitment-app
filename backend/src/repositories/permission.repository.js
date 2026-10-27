
import pool from "../config/database.js";

export async function getAllPermissions() {
  const [rows] = await pool.execute(
    `SELECT id, name, description
     FROM permissions
     ORDER BY name ASC`
  );

  return rows;
}

export async function getPermissionsByRoleId(roleId) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.name, p.description
     FROM permissions p
     INNER JOIN role_permissions rp
       ON rp.permission_id = p.id
     WHERE rp.role_id = ?
     ORDER BY p.name ASC`,
    [roleId]
  );

  return rows;
}

export async function replaceRolePermissions(roleId, permissionIds) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Ensure the role exists.
    const [roles] = await connection.execute(
      "SELECT id FROM roles WHERE id = ?",
      [roleId]
    );

    if (roles.length === 0) {
      const error = new Error("Role not found");
      error.statusCode = 404;
      throw error;
    }

    // Ensure every requested permission exists.
    if (permissionIds.length > 0) {
      const placeholders = permissionIds.map(() => "?").join(", ");

      const [permissions] = await connection.execute(
        `SELECT id FROM permissions WHERE id IN (${placeholders})`,
        permissionIds
      );

      if (permissions.length !== permissionIds.length) {
        const error = new Error(
          "One or more permission IDs are invalid"
        );
        error.statusCode = 400;
        throw error;
      }
    }

    await connection.execute(
      "DELETE FROM role_permissions WHERE role_id = ?",
      [roleId]
    );

    if (permissionIds.length > 0) {
      const values = permissionIds.map(() => "(?, ?)").join(", ");
      const parameters = permissionIds.flatMap((id) => [
        roleId,
        id,
      ]);

      await connection.execute(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ${values}`,
        parameters
      );
    }

    await connection.commit();

    return getPermissionsByRoleId(roleId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
