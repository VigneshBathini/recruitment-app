
import { Router } from "express";

import {
  createDepartmentController,
  getDepartmentsController,
  updateDepartmentController,
} from "../controllers/department.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizePermission } from "../middleware/authorizePermission.middleware.js";

const router = Router();

// Require a valid JWT for every department endpoint.
router.use(authenticateToken);

// Read departments.
router.get(
  "/:organizationId",
  authorizePermission("department.view"),
  getDepartmentsController
);

// Create departments.
router.post(
  "/",
  authorizePermission("department.manage"),
  createDepartmentController
);

// Update departments.
router.put(
  "/:id",
  authorizePermission("department.manage"),
  updateDepartmentController
);

export default router;
