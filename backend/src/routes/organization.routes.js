
import { Router } from "express";
import { createOrganizationController ,getOrganizationsController} from "../controllers/organization.controller.js";

const router = Router();

router.post("/", createOrganizationController);

router.get("/",getOrganizationsController)

export default router;
