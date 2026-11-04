
import { Router } from "express";

import {
  createDepartmentController,
  getDepartmentsController,
  updateDepartmentController,
} from "../controllers/department.controller.js";

import { authenticateManagementToken } from "../middleware/authenticateManagementToken.middleware.js";
import { authorizeManagementPermission } from "../middleware/authorizeManagementPermission.middleware.js";

const router = Router();

// Require a valid JWT for every department endpoint.
router.use(authenticateManagementToken);

// Read departments.
router.get(
  "/:organizationId",
  // Requirement managers need the organization-scoped list to assign a department
  // when creating a requirement.
  authorizeManagementPermission(["department.view", "requirement.manage"]),
  getDepartmentsController
);

// Create departments.
router.post(
  "/",
  authorizeManagementPermission("department.manage"),
  createDepartmentController
);

// Update departments.
router.put(
  "/:id",
  authorizeManagementPermission("department.manage"),
  updateDepartmentController
);

export default router;
