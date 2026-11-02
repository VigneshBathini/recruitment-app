
import { Router } from "express";
import { currentUserController, loginController } from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();

// POST /api/auth/login
router.post("/login", loginController);
router.get("/me", authenticateToken, currentUserController);

export default router;
