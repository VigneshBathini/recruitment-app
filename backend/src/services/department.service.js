
import * as departmentRepository from "../repositories/department.repository.js";

export async function createDepartment(data) {
  return departmentRepository.createDepartment(data);
}

export async function getDepartmentsByOrganization(
  organizationId,
) {
  return departmentRepository.getDepartmentsByOrganization(
    organizationId,
  );
}

export async function updateDepartment(id, data) {
  return departmentRepository.updateDepartment(id, data);
}
