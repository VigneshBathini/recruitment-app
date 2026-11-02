
import { Router } from "express";

import {
  createRequirementController,
  getRequirementsController,
  getRequirementController,
  updateRequirementController,
} from "../controllers/requirement.controller.js";

import { authenticateManagementToken } from "../middleware/authenticateManagementToken.middleware.js";
import { authorizeManagementPermission } from "../middleware/authorizeManagementPermission.middleware.js";

const router = Router();

// All requirement routes require authentication
router.use(authenticateManagementToken);

// View requirements
router.get(
  "/",
  authorizeManagementPermission("requirement.view"),
  getRequirementsController
);

router.get(
  "/:id",
  authorizeManagementPermission("requirement.view"),
  getRequirementController
);

// Create a requirement
router.post(
  "/",
  authorizeManagementPermission("requirement.manage"),
  createRequirementController
);

// Update a draft requirement
router.put(
  "/:id",
  authorizeManagementPermission("requirement.manage"),
  updateRequirementController
);

export default router;
