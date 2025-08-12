import express from "express";
import { authenticateToken } from "../../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../../middleware/roleMiddleware.js";
import {
  createApplication,
  updateStepStatus,
  addNote,
  updateOnboardingDetails,
  getApplicationById,
  getAllApplications,
  showApplicationWithStatus,
  getApplicationByCustomerId,
  reviewApplicationAfterOnboarding,
  updateApplication,
  lockOrUnlockApplication,
} from "../controllers/applicationController.js";

const router = express.Router();

// Create a new application — allowed for agent/admin
router.post(
  "/create",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  createApplication
);

// Update Onboarding Details - customer
router.put(
  "/onboarding/:customerId",
  authenticateToken,
  authorizeRoles("customer"),
  updateOnboardingDetails
);

router.patch(
  "/customer/:applicationId",
  authenticateToken,
  authorizeRoles("admin", "agent"),
  updateApplication
);

router.patch(
  "/review-after-onboarding/:applicationId",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  reviewApplicationAfterOnboarding
);

// Update application step status — agent/admin
router.patch(
  "/step-status/:customerId",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  updateStepStatus
);

router.patch(
  "/:applicationId/lock",
  authenticateToken,
  authorizeRoles("admin", "agent"),
  lockOrUnlockApplication
);

// Add note for clarification
router.post(
  "/note/:customerId",
  authenticateToken,
  authorizeRoles("agent", "customer", "admin"),
  addNote
);

router.get(
  "/:appId",
  authenticateToken,
  authorizeRoles("agent", "customer", "admin"),
  getApplicationById
);

router.get(
  "/app/:customerId",
  authenticateToken,
  authorizeRoles("agent", "customer", "admin"),
  getApplicationByCustomerId
);

// Get all applications — allowed for agent/admin
router.get(
  "/",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  getAllApplications
);

router.get(
  "/status/:customerId",
  authenticateToken,
  authorizeRoles("agent", "customer", "admin"),
  showApplicationWithStatus
);

export default router;
