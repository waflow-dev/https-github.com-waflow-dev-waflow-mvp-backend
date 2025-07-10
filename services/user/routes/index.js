import { authenticateToken } from "../../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../../middleware/roleMiddleware.js";

import express from "express";

import {
  createAgent,
  createCustomer,
  createAdmin,
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
router.post(
  "/create-admin",
  authenticateToken,
  authorizeRoles("admin"),
  createAdmin
);

export default router;
