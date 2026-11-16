import { Router } from "express";
import {
  loginCandidateController,
  registerCandidateController,
} from "../controllers/candidate.controller.js";

const router = Router();
router.post("/register", registerCandidateController);
router.post("/login", loginCandidateController);
export default router;
