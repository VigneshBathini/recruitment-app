
import express from "express";
import {
  authenticatePlatformAdminToken,
} from "../middleware/platformAdminAuth.middleware.js";

const router = express.Router();

router.get("/me", authenticatePlatformAdminToken, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Platform Admin session is valid",
    data: {
      user: req.user,
    },
  });
});

export default router;
