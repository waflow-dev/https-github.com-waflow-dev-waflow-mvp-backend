import { authenticateToken } from "../../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../../middleware/roleMiddleware.js";

import express from "express";

import {
  loginUser,
  createAgent,
  createCustomer,
  createAdmin,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/login", loginUser);
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
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

export default router;
