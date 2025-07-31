import express from "express";
import {
  getUnreadNotifications,
  markAsRead,
  clearAllNotifications,
} from "../controllers/notificationController.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/notifications", authenticateToken, getUnreadNotifications);
router.patch("/notifications/read/:id", authenticateToken, markAsRead);
router.patch(
  "/notifications/clear-all",
  authenticateToken,
  clearAllNotifications
);

export default router;
