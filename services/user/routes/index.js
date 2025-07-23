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
  "/customer/profile/:id",
  (req, res, next) => {
    console.log("[DEBUG] /customer/profile route hit");
    next();
  },
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

router.get("/customers", authenticateToken, getAllCustomers);

router.get("/agents", authenticateToken, authorizeRoles("admin"), getAllAgents);

export default router;
