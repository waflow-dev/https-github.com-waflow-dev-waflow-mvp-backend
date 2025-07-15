import express from "express";
import { authenticateToken } from "../../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../../middleware/roleMiddleware.js";
import {
  createApplication,
  updateStepStatus,
  addNote,
  updateVisaSubStep,
  addVisaMember,
  reviewApplication,
  updateOnboardingDetails,
  getApplicationById,
} from "../controllers/applicationController.js";

const router = express.Router();

// Create a new application — allowed for agent/admin
router.post(
  "/create",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  createApplication
);

// Update workflow step status — agent/admin
router.patch(
  "/step/:appId",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  updateStepStatus
);

// Add note for clarification — agent/admin
router.post(
  "/note/:appId",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  addNote
);

// Update visa substep status — agent/admin
router.patch(
  "/visa-substep/:appId/:memberId",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  updateVisaSubStep
);

// Add visa applicant — agent/admin
router.post(
  "/visa-member/:appId",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  addVisaMember
);

// Review application — agent/admin
router.post(
  "/review/:applicationId",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  reviewApplication
);

// Update Onboarding Details - customer
router.put(
  "/onboarding/:customerId",
  authenticateToken,
  authorizeRoles("customer"),
  updateOnboardingDetails
);

router.get("/:appId", authenticateToken, getApplicationById);

export default router;
