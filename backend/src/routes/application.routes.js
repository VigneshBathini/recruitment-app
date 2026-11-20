import { Router } from "express";
import {
  getApplicationDashboardController,
  getApplicationDetailsController,
  getApplicationReviewQueueController,
  getApplicationReviewDetailsController,
  decideOnApplicationController,
  listApplicationsController,
  moveApplicationToStageController,
  rejectApplicationController,
  shortlistApplicationController,
  validateProgressBody,
  validateDecisionBody,
} from "../controllers/application.controller.js";
import { authenticateManagementToken } from "../middleware/authenticateManagementToken.middleware.js";
import { authorizeManagementPermission } from "../middleware/authorizeManagementPermission.middleware.js";

const router = Router();
router.use(authenticateManagementToken);

router.get("/dashboard", authorizeManagementPermission("application.view"), getApplicationDashboardController);
router.get("/review-queue", authorizeManagementPermission("application.review"), getApplicationReviewQueueController);
router.get("/:id/review", authorizeManagementPermission("application.review"), getApplicationReviewDetailsController);
router.post("/:id/decision", authorizeManagementPermission("application.decision"), validateDecisionBody, decideOnApplicationController);
router.get("/", authorizeManagementPermission("application.view"), listApplicationsController);
router.get("/:id", authorizeManagementPermission("application.view"), getApplicationDetailsController);
router.patch("/:id/stage", authorizeManagementPermission("application.manage"), validateProgressBody, moveApplicationToStageController);
router.post("/:id/shortlist", authorizeManagementPermission("application.manage"), validateProgressBody, shortlistApplicationController);
router.post("/:id/reject", authorizeManagementPermission("application.manage"), validateProgressBody, rejectApplicationController);

export default router;
