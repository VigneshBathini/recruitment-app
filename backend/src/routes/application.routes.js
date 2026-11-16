import { Router } from "express";
import {
  getApplicationDashboardController,
  getApplicationDetailsController,
  listApplicationsController,
  moveApplicationToStageController,
  rejectApplicationController,
  shortlistApplicationController,
  validateProgressBody,
} from "../controllers/application.controller.js";
import { authenticateManagementToken } from "../middleware/authenticateManagementToken.middleware.js";
import { authorizeManagementPermission } from "../middleware/authorizeManagementPermission.middleware.js";

const router = Router();
router.use(authenticateManagementToken);

router.get("/dashboard", authorizeManagementPermission("application.view"), getApplicationDashboardController);
router.get("/", authorizeManagementPermission("application.view"), listApplicationsController);
router.get("/:id", authorizeManagementPermission("application.view"), getApplicationDetailsController);
router.patch("/:id/stage", authorizeManagementPermission("application.manage"), validateProgressBody, moveApplicationToStageController);
router.post("/:id/shortlist", authorizeManagementPermission("application.manage"), validateProgressBody, shortlistApplicationController);
router.post("/:id/reject", authorizeManagementPermission("application.manage"), validateProgressBody, rejectApplicationController);

export default router;
