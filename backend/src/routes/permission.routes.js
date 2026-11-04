
import { Router } from "express";

import {
  getPermissionsController,
  getRolePermissionsController,
  updateRolePermissionsController,
} from "../controllers/permission.controller.js";

import { authenticateManagementToken } from "../middleware/authenticateManagementToken.middleware.js";



const router = Router();

router.use(authenticateManagementToken);

router.get("/", getPermissionsController);
router.get("/role/:roleId", getRolePermissionsController);
router.put("/role/:roleId", (req, res, next) => {
  if (req.user?.account_type === "platform_admin") {
    return res.status(403).json({ success: false, message: "Platform Admin access is read-only" });
  }
  return next();
}, updateRolePermissionsController);

export default router;
