
import { Router } from "express";

import {
  getPermissionsController,
  getRolePermissionsController,
  updateRolePermissionsController,
} from "../controllers/permission.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorizeRole.middleware.js";



const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles("Organization Admin"));

router.get("/", getPermissionsController);
router.get("/role/:roleId", getRolePermissionsController);
router.put("/role/:roleId", updateRolePermissionsController);

export default router;
