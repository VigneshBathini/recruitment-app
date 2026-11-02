
import { Router } from "express";

import {
  createRequirementController,
  getRequirementsController,
  getRequirementController,
  updateRequirementController,
} from "../controllers/requirement.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizePermission } from "../middleware/authorizePermission.middleware.js";

const router = Router();

// All requirement routes require authentication
router.use(authenticateToken);

// View requirements
router.get(
  "/",
  authorizePermission("requirement.view"),
  getRequirementsController
);

router.get(
  "/:id",
  authorizePermission("requirement.view"),
  getRequirementController
);

// Create a requirement
router.post(
  "/",
  authorizePermission("requirement.manage"),
  createRequirementController
);

// Update a draft requirement
router.put(
  "/:id",
  authorizePermission("requirement.manage"),
  updateRequirementController
);

export default router;
