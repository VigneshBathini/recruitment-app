
import pool from "../config/database.js";

export async function getAllPermissions() {
  const [rows] = await pool.execute(
    `SELECT id, name, description
     FROM permissions
     ORDER BY name ASC`
  );

  return rows;
}

// Get permissions for a specific organization's role
export async function getPermissionsByRoleId(
  organizationId,
  roleId
) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.name, p.description
     FROM permissions p
     INNER JOIN organization_role_permissions orp
       ON orp.permission_id = p.id
     WHERE orp.organization_id = ?
       AND orp.role_id = ?
     ORDER BY p.name ASC`,
    [organizationId, roleId]
  );

  return rows;
}

// Replace permissions for one organization's role
export async function replaceRolePermissions(
  organizationId,
  roleId,
  permissionIds
) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Validate organization
    const [organizations] = await connection.execute(
      "SELECT id FROM organizations WHERE id = ?",
      [organizationId]
    );

    if (organizations.length === 0) {
      const error = new Error("Organization not found");
      error.statusCode = 404;
      throw error;
    }

    // Validate role
    const [roles] = await connection.execute(
      "SELECT id FROM roles WHERE id = ?",
      [roleId]
    );

    if (roles.length === 0) {
      const error = new Error("Role not found");
      error.statusCode = 404;
      throw error;
    }

    // Validate permission IDs
    if (permissionIds.length > 0) {
      const placeholders = permissionIds.map(() => "?").join(", ");

      const [permissions] = await connection.execute(
        `SELECT id FROM permissions
         WHERE id IN (${placeholders})`,
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

    // Delete only this organization's role permissions
    await connection.execute(
      `DELETE FROM organization_role_permissions
       WHERE organization_id = ?
       AND role_id = ?`,
      [organizationId, roleId]
    );

    // Insert updated permissions
    if (permissionIds.length > 0) {
      const values = permissionIds.map(() => "(?, ?, ?)").join(", ");

      const parameters = permissionIds.flatMap((permissionId) => [
        organizationId,
        roleId,
        permissionId,
      ]);

      await connection.execute(
        `INSERT INTO organization_role_permissions
         (organization_id, role_id, permission_id)
         VALUES ${values}`,
        parameters
      );
    }

    await connection.commit();

    return getPermissionsByRoleId(organizationId, roleId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
