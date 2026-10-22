
import { Router } from "express";

import {
  createUserController,
  getUsersController,
  updateUserController,
  updateUserStatusController,
} from "../controllers/user.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorizeRole.middleware.js";

const router = Router();

// Step 1: Require a valid JWT.
router.use(authenticateToken);

// Step 2: Restrict user management to Organization Admin.
router.use(authorizeRoles("Organization Admin"));

router.post("/", createUserController);
router.get("/organization/:organizationId", getUsersController);
router.put("/:id", updateUserController);
router.patch("/:id/status", updateUserStatusController);

export default router;
