import { Router } from "express";
import {
  loginCandidateController,
  registerCandidateController,
} from "../controllers/candidate.controller.js";
import {
  candidateLoginRateLimit,
  candidateRegistrationRateLimit,
} from "../middleware/authRateLimit.middleware.js";

const router = Router();
router.post("/register", candidateRegistrationRateLimit, registerCandidateController);
router.post("/login", candidateLoginRateLimit, loginCandidateController);
export default router;
