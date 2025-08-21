import express from "express";
import {
  getUnreadNotifications,
  markAsRead,
  clearAllNotifications,
  getCustomerNotifications,
  getAgentNotifications,
  getAdminNotifications,
} from "../controllers/notificationController.js";
import { authenticateToken } from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/customer/:customerId", getCustomerNotifications);
router.get("/agent/:agentId", getAgentNotifications);
router.get("/admin/:adminId", getAdminNotifications);
router.get("/", authenticateToken, getUnreadNotifications);
router.patch("/read/:id", markAsRead);
router.patch("/clear-all", authenticateToken, clearAllNotifications);

export default router;
