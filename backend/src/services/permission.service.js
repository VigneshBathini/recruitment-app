
import {
  getAllPermissions,
  getPermissionsByRoleId,
  replaceRolePermissions,
} from "../repositories/permission.repository.js";

export async function getPermissions() {
  return getAllPermissions();
}

export async function getRolePermissions(
  organizationId,
  roleId
) {
  return getPermissionsByRoleId(
    organizationId,
    roleId
  );
}

export async function updateRolePermissions(
  organizationId,
  roleId,
  permissionIds
) {
  return replaceRolePermissions(
    organizationId,
    roleId,
    permissionIds
  );
}
