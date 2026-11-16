import { Router } from "express";
import {
  approveJobDescriptionController,
  createJobDescriptionController,
  getJobDescriptionApprovalHistoryController,
  getJobDescriptionController,
  getJobDescriptionsController,
  publishJobDescriptionController,
  rejectJobDescriptionController,
  submitJobDescriptionController,
  updateJobDescriptionController,
} from "../controllers/jobDescription.controller.js";
import { getApprovalWorkflowsService } from "../services/approval.service.js";
import { authenticateManagementToken } from "../middleware/authenticateManagementToken.middleware.js";
import { authorizeManagementPermission } from "../middleware/authorizeManagementPermission.middleware.js";

const router = Router();
router.use(authenticateManagementToken);

router.get(
  "/workflows",
  authorizeManagementPermission("job.manage"),
  async (req, res, next) => {
    try {
      const workflows = await getApprovalWorkflowsService("JOB", req.user);
      return res.status(200).json({ success: true, data: workflows });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/",
  authorizeManagementPermission(["job.view", "job.manage", "job.approve"]),
  getJobDescriptionsController
);
router.post(
  "/from-requirement/:requirementId",
  authorizeManagementPermission("job.manage"),
  createJobDescriptionController
);
router.get(
  "/:id/approval-history",
  authorizeManagementPermission(["job.view", "job.approve"]),
  getJobDescriptionApprovalHistoryController
);
router.post(
  "/:id/submit",
  authorizeManagementPermission("job.manage"),
  submitJobDescriptionController
);
router.post(
  "/:id/approve",
  authorizeManagementPermission("job.approve"),
  approveJobDescriptionController
);
router.post(
  "/:id/reject",
  authorizeManagementPermission("job.approve"),
  rejectJobDescriptionController
);
router.post(
  "/:id/publish",
  authorizeManagementPermission("job.publish"),
  publishJobDescriptionController
);
router.get(
  "/:id",
  authorizeManagementPermission(["job.view", "job.manage", "job.approve"]),
  getJobDescriptionController
);
router.put(
  "/:id",
  authorizeManagementPermission("job.manage"),
  updateJobDescriptionController
);

export default router;
