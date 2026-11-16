import { Router } from "express";
import {
  getPublicJobController,
  getPublicJobsController,
} from "../controllers/publicJob.controller.js";

const router = Router();

router.get(
  "/organizations/:organizationSlug/jobs/:jobId",
  getPublicJobController
);
router.get(
  "/organizations/:organizationSlug/jobs",
  getPublicJobsController
);

export default router;
