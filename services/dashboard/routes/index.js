import express from "express";
import { authenticateToken } from "../../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../../middleware/roleMiddleware.js";

import {
  getAdminDashboard,
  getAgentDashboard,
  getCustomerDashboard,
} from "../controllers/dashboardController.js";

const router = express.Router();

router.get(
  "/admin",
  authenticateToken,
  authorizeRoles("admin"),
  getAdminDashboard
);
router.get(
  "/agent/:agentId",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  getAgentDashboard
);
router.get(
  "/customer/:customerId",
  authenticateToken,
  authorizeRoles("customer"),
  getCustomerDashboard
);

export default router;
