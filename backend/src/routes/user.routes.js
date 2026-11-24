
import { Router } from "express";

import {
  createUserController,
  getUsersController,
  updateUserController,
  updateUserStatusController,
} from "../controllers/user.controller.js";

import { authenticateManagementToken } from "../middleware/authenticateManagementToken.middleware.js";
import { authorizeUserManagement } from "../middleware/authorizeOrganizationAdmin.middleware.js";

const router = Router();

// Step 1: Require a valid JWT.
router.use(authenticateManagementToken);
router.use(authorizeUserManagement);

router.post("/", createUserController);
router.get("/organization/:organizationId", getUsersController);
router.put("/:id", updateUserController);
router.patch("/:id/status", updateUserStatusController);

export default router;
