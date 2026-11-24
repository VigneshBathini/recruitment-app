import express, { Router } from "express";
import {
  applyToJobController,
  acceptCandidateOfferController,
  declineCandidateOfferController,
  getCandidateOfferController,
  getCandidateOffersController,
  getCandidateApplicationsController,
  getCandidateProfileController,
  getCandidateResumeFileController,
  updateCandidateProfileController,
  withdrawCandidateApplicationController,
  uploadCandidateResumeController,
} from "../controllers/candidate.controller.js";
import {
  getMyOnboardingController,
  getMyOnboardingDetailsController,
  getMyOnboardingDocumentFileController,
  getMyOnboardingTasksController,
  listMyOnboardingDocumentsController,
  updateMyOnboardingTaskController,
  uploadMyOnboardingDocumentController,
} from "../controllers/onboarding.controller.js";
import { authenticateCandidateToken } from "../middleware/authenticateCandidateToken.middleware.js";
import { listCandidateInterviewsController } from "../controllers/interview.controller.js";

const router = Router();
router.use(authenticateCandidateToken);
router.get("/me", getCandidateProfileController);
router.put("/me", updateCandidateProfileController);
router.get("/me/resume/file", getCandidateResumeFileController);
router.post("/me/resume", express.raw({ type: "*/*", limit: "10mb" }), uploadCandidateResumeController);
router.post("/me/applications", applyToJobController);
router.post("/me/applications/:id/withdraw", withdrawCandidateApplicationController);
router.get("/me/applications", getCandidateApplicationsController);
router.get("/me/interviews", listCandidateInterviewsController);
router.get("/me/offers", getCandidateOffersController);
router.get("/me/offers/:id", getCandidateOfferController);
router.post("/me/offers/:id/accept", acceptCandidateOfferController);
router.post("/me/offers/:id/decline", declineCandidateOfferController);
router.get("/me/onboarding", getMyOnboardingController);
router.get("/me/onboarding/documents/:documentId/file", getMyOnboardingDocumentFileController);
router.get("/me/onboarding/:id", getMyOnboardingDetailsController);
router.get("/me/onboarding/:id/tasks", getMyOnboardingTasksController);
router.get("/me/onboarding/:id/documents", listMyOnboardingDocumentsController);
router.post("/me/onboarding/:id/documents", express.raw({ type: "*/*", limit: "10mb" }), uploadMyOnboardingDocumentController);
router.patch("/me/onboarding/tasks/:taskId", updateMyOnboardingTaskController);
export default router;
