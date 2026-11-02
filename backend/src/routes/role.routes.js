
import { Router } from "express";
import { getRolesController } from "../controllers/role.controller.js";
import { authenticateManagementToken } from "../middleware/authenticateManagementToken.middleware.js";


const router = Router();

// Require a valid login before returning roles.
router.use(authenticateManagementToken);

router.get("/", getRolesController);

export default router;
