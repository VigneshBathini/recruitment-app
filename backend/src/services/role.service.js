
import { getAllRoles } from "../repositories/role.repository.js";

export async function getRoles() {
  return getAllRoles();
}
