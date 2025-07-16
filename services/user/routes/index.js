import { authenticateToken } from "../../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../../middleware/roleMiddleware.js";

import express from "express";

import {
  createAgent,
  createCustomer,
  createAdmin,
  getCustomerDetails,
  getAgentDetails,
  getAdminDetails,
} from "../controllers/userController.js";

const router = express.Router();

router.post(
  "/create-agent",
  authenticateToken,
  authorizeRoles("admin"),
  createAgent
);
router.post(
  "/create-customer",
  authenticateToken,
  authorizeRoles("admin", "agent"),
  createCustomer
);
router.post("/create-admin", createAdmin);

router.get(
  "/customer/profile",
  authenticateToken,
  authorizeRoles("customer"),
  getCustomerDetails
);
router.get(
  "/agent/profile",
  authenticateToken,
  authorizeRoles("agent"),
  getAgentDetails
);
router.get(
  "/admin/profile",
  authenticateToken,
  authorizeRoles("admin"),
  getAdminDetails
);

export default router;
