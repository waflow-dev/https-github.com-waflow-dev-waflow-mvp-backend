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
  getAllCustomers,
  getAllAgents,
  updateAgent,
  updateCustomer,
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
  "/customer/:customerId",
  authenticateToken,
  authorizeRoles("agent", "admin", "customer"),
  getCustomerDetails
);

router.get("/agents/:agentId", getAgentDetails);

router.get(
  "/admin/profile",
  authenticateToken,
  authorizeRoles("admin"),
  getAdminDetails
);

router.get(
  "/customers",
  authenticateToken,
  authorizeRoles("admin", "agent"),
  getAllCustomers
);

router.get("/agents", authenticateToken, authorizeRoles("admin"), getAllAgents);

router.put(
  "/agent/:agentId",
  authenticateToken,
  authorizeRoles("admin"),
  updateAgent
);

router.put(
  "/customer/:customerId",
  authenticateToken,
  authorizeRoles("admin", "agent", "customer"),
  updateCustomer
);

export default router;
