import { Router } from "express";
import {
  createOfferController,
  getOfferController,
  getOfferWorkflowsController,
  issueOfferController,
  listOffersController,
  submitOfferController,
  updateOfferController,
} from "../controllers/offer.controller.js";
import { authenticateManagementToken } from "../middleware/authenticateManagementToken.middleware.js";
import { authorizeManagementPermission } from "../middleware/authorizeManagementPermission.middleware.js";

const router = Router();
router.use(authenticateManagementToken);

router.get("/workflows", authorizeManagementPermission("offer.manage"), getOfferWorkflowsController);
router.get("/", authorizeManagementPermission("offer.view"), listOffersController);
router.post("/", authorizeManagementPermission("offer.manage"), createOfferController);
router.get("/:id", authorizeManagementPermission(["offer.view", "offer.manage", "offer.approve", "offer.issue"]), getOfferController);
router.patch("/:id", authorizeManagementPermission("offer.manage"), updateOfferController);
router.post("/:id/submit", authorizeManagementPermission("offer.manage"), submitOfferController);
router.post("/:id/issue", authorizeManagementPermission("offer.issue"), issueOfferController);

export default router;
