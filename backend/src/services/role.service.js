
import { getRolesByOrganization } from "../repositories/role.repository.js";

export async function getRoles(organizationId) {
  return getRolesByOrganization(organizationId);
}
