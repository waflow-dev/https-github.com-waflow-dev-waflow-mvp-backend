import express from "express";
import {
  getUnreadNotifications,
  markAsRead,
  clearAllNotifications,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/notifications", getUnreadNotifications);
router.patch("/notifications/read/:id", markAsRead);
router.patch("/notifications/clear-all", clearAllNotifications);

export default router;
