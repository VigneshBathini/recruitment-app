
import { Router } from "express";
import { getRolesController } from "../controllers/role.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";


const router = Router();

// Require a valid login before returning roles.
router.use(authenticateToken);

router.get("/", getRolesController);

export default router;
