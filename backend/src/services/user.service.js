import bcrypt from "bcryptjs";

import {
  createUser as createUserRepository,
  organizationExists,
  roleExists,
  getRoleById,
  departmentBelongsToOrganization,
  getUsersByOrganization,
  updateUser,
  setUserStatus,
} from "../repositories/user.repository.js";

export async function createUser(data) {
  const organizationIsValid = await organizationExists(
    data.organization_id
  );

  if (!organizationIsValid) {
    throw new Error("Organization not found");
  }

 const role = await getRoleById(data.role_id);
validateAssignableRole(role);

  if (data.department_id != null) {
    const departmentIsValid =
      await departmentBelongsToOrganization(
        data.department_id,
        data.organization_id
      );

    if (!departmentIsValid) {
      throw new Error(
        "Department not found or does not belong to this organization"
      );
    }
  }

  const userData = {
    ...data,
    first_name: data.first_name.trim(),
    last_name: data.last_name?.trim() || null,
    email: data.email.trim().toLowerCase(),
  };

  userData.password_hash = await bcrypt.hash(data.password, 12);
  delete userData.password;

  return createUserRepository(userData);
}

export async function getUsers(organizationId) {
  const organizationIsValid =
    await organizationExists(organizationId);

  if (!organizationIsValid) {
    throw new Error("Organization not found");
  }

  return getUsersByOrganization(organizationId);
}



export async function updateUserService(id, organizationId, data) {
  // 1. Verify that the organization exists.
  const orgExists = await organizationExists(organizationId);

  if (!orgExists) {
    const error = new Error("Organization not found");
    error.statusCode = 400;
    throw error;
  }

  // 2. Verify that the selected role exists.
const role = await getRoleById(data.role_id);
validateAssignableRole(role);

  // 3. Verify that the department belongs to this organization.
  if (data.department_id != null) {
    const departmentIsValid = await departmentBelongsToOrganization(
      data.department_id,
      organizationId
    );

    if (!departmentIsValid) {
      const error = new Error(
        "Selected department does not belong to this organization"
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // 4. Normalize user input.
  const normalizedData = {
    ...data,
    first_name: data.first_name.trim(),
    last_name: data.last_name?.trim() || null,
    email: data.email.trim().toLowerCase(),
  };

  // 5. Update the user.
  const updatedUser = await updateUser(
    id,
    organizationId,
    normalizedData
  );

  if (!updatedUser) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  return updatedUser;
}



export async function setUserStatusService(
  id,
  organizationId,
  isActive
) {
  const orgExists = await organizationExists(organizationId);

  if (!orgExists) {
    const error = new Error("Organization not found");
    error.statusCode = 400;
    throw error;
  }

  const user = await setUserStatus(id, organizationId, isActive);

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  return user;
}


function validateAssignableRole(role) {
  if (!role) {
    const error = new Error("Role not found");
    error.statusCode = 400;
    throw error;
  }

  if (role.name === "Organization Admin") {
    const error = new Error(
      "You cannot assign the Organization Admin role through user management"
    );
    error.statusCode = 403;
    throw error;
  }
}