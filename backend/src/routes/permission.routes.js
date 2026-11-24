
import { Router } from "express";

import {
  getPermissionsController,
  getRolePermissionsController,
  updateRolePermissionsController,
} from "../controllers/permission.controller.js";

import { authenticateManagementToken } from "../middleware/authenticateManagementToken.middleware.js";
import {
  authorizeOrganizationAdmin,
  preventOwnRolePermissionChange,
} from "../middleware/authorizeOrganizationAdmin.middleware.js";



const router = Router();

router.use(authenticateManagementToken);

router.get("/", getPermissionsController);
router.get("/role/:roleId", getRolePermissionsController);
router.put("/role/:roleId", authorizeOrganizationAdmin, preventOwnRolePermissionChange, updateRolePermissionsController);

export default router;
