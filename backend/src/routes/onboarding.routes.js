import { Router } from "express";
import {
  completeOnboardingController, createOnboardingController, createOnboardingTaskController,
  getOnboardingController, getOnboardingDashboardController, getOnboardingHistoryController,
  getOnboardingDocumentFileController, listOnboardingController,
  listOnboardingTasksController, reviewOnboardingDocumentController,
  updateOnboardingController, updateOnboardingTaskController,
} from "../controllers/onboarding.controller.js";
import { authenticateManagementToken } from "../middleware/authenticateManagementToken.middleware.js";
import { authorizeManagementPermission } from "../middleware/authorizeManagementPermission.middleware.js";

const router = Router();
router.use(authenticateManagementToken);
router.use((req, res, next) => {
  if (req.user?.account_type !== "organization_user" || !req.user.organization_id) {
    return res.status(403).json({ success: false, message: "Organization user access is required" });
  }
  return next();
});

router.get("/dashboard", authorizeManagementPermission(["onboarding.view", "onboarding.manage", "onboarding.complete"]), getOnboardingDashboardController);
router.get("/", authorizeManagementPermission(["onboarding.view", "onboarding.manage", "onboarding.complete"]), listOnboardingController);
router.post("/", authorizeManagementPermission("onboarding.manage"), createOnboardingController);
router.post("/:id/complete", authorizeManagementPermission("onboarding.complete"), completeOnboardingController);
router.patch("/tasks/:taskId", authorizeManagementPermission("onboarding.manage"), updateOnboardingTaskController);
router.post("/documents/:documentId/review", authorizeManagementPermission("onboarding.document.review"), reviewOnboardingDocumentController);
router.get("/documents/:documentId/file", authorizeManagementPermission(["onboarding.view", "onboarding.document.review"]), getOnboardingDocumentFileController);
router.get("/:id/history", authorizeManagementPermission(["onboarding.view", "onboarding.manage", "onboarding.complete"]), getOnboardingHistoryController);
router.get("/:id/tasks", authorizeManagementPermission(["onboarding.view", "onboarding.manage", "onboarding.complete"]), listOnboardingTasksController);
router.post("/:id/tasks", authorizeManagementPermission("onboarding.manage"), createOnboardingTaskController);
router.get("/:id", authorizeManagementPermission(["onboarding.view", "onboarding.manage", "onboarding.complete"]), getOnboardingController);
router.patch("/:id", authorizeManagementPermission("onboarding.manage"), updateOnboardingController);

export default router;
