import { Router } from "express";
import {
  approveRequestController,
  getApprovalRequestController,
  getApprovalWorkflowsController,
  rejectRequestController,
  submitApprovalRequestController,
} from "../controllers/approval.controller.js";
import { authenticateManagementToken } from "../middleware/authenticateManagementToken.middleware.js";

const router = Router();
router.use(authenticateManagementToken);

router.get("/workflows", getApprovalWorkflowsController);
router.post("/requests", submitApprovalRequestController);
router.get("/requests/:id", getApprovalRequestController);
router.post("/requests/:id/approve", approveRequestController);
router.post("/requests/:id/reject", rejectRequestController);

export default router;
