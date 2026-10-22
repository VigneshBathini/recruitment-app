
import { Router } from "express";
import {
  createDepartmentController,
  getDepartmentsController,
  updateDepartmentController
} from "../controllers/department.controller.js";

const router = Router();

router.post("/", createDepartmentController);
router.get("/:organizationId", getDepartmentsController);
router.put("/:id", updateDepartmentController);

export default router;
