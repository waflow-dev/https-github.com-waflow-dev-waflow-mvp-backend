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
  getAllApplications,
  showApplicationWithStatus,
} from "../controllers/applicationController.js";

const router = express.Router();

// Get all applications — allowed for agent/admin
router.get(
  "/",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  getAllApplications
);

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

// Add note for clarification
router.post("/note/:appId", authenticateToken, addNote);

// Update visa substep status — agent/admin
router.patch(
  "/visa-substep/:appId/:memberId",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  updateVisaSubStep
);

// Add visa applicant — agent/admin
router.post("/visa-member/:appId", addVisaMember);

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

router.get("/status/:customerId", authenticateToken, showApplicationWithStatus);

export default router;
