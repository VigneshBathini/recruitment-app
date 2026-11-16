import { Router } from "express";
import {
  applyToJobController,
  getCandidateApplicationsController,
  getCandidateProfileController,
  updateCandidateProfileController,
} from "../controllers/candidate.controller.js";
import { authenticateCandidateToken } from "../middleware/authenticateCandidateToken.middleware.js";

const router = Router();
router.use(authenticateCandidateToken);
router.get("/me", getCandidateProfileController);
router.put("/me", updateCandidateProfileController);
router.post("/me/applications", applyToJobController);
router.get("/me/applications", getCandidateApplicationsController);
export default router;
