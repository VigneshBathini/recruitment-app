
import { Router } from "express";
import { createOrganizationController, getOrganizationsController, updateOrganizationController, updateOrganizationStatusController } from "../controllers/organization.controller.js";
import { authenticatePlatformAdminToken } from "../middleware/platformAdminAuth.middleware.js";

const router = Router();

router.use(authenticatePlatformAdminToken);
router.post("/", createOrganizationController);

router.get("/", getOrganizationsController);
router.put("/:id", updateOrganizationController);
router.patch("/:id/status", updateOrganizationStatusController);

export default router;
