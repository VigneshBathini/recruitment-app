
import { Router } from "express";

import {
  createRequirementController,
  getRequirementsController,
  getRequirementController,
  updateRequirementController,
  submitRequirementController,
  getPendingRequirementsController,
  approveRequirementController,
  rejectRequirementController
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

// Get requirements pending approval
router.get(
  "/pending",
  authorizeManagementPermission("requirement.view"),
  getPendingRequirementsController
);

// View requirement by ID
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

// Submit a requirement for approval
router.patch(
  "/:id/submit",
   authorizeManagementPermission("requirement.manage"),
  submitRequirementController
)


// Approve a requirement
router.patch(
  "/:id/approve",
  authorizeManagementPermission("requirement.approve"),
  approveRequirementController
)

// Reject a requirement
router.patch(
   "/:id/reject",
  authorizeManagementPermission("requirement.approve"),
  rejectRequirementController
)

export default router;
