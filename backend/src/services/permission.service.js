
import {
  getAllPermissions,
  getPermissionsByRoleId,
  replaceRolePermissions,
} from "../repositories/permission.repository.js";

export async function getPermissions() {
  return getAllPermissions();
}

export async function getRolePermissions(roleId) {
  return getPermissionsByRoleId(roleId);
}

export async function updateRolePermissions(roleId, permissionIds) {
  return replaceRolePermissions(roleId, permissionIds);
}
