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
} from "../controllers/applicationController.js";
import {
  createVisaApplication,
  getAllVisaApplications,
  getVisaApplicationById,
  approveVisaApplication,
} from "../controllers/visaApplicationController.js";

const router = express.Router();

// Get all applications — allowed for agent/admin
router.get(
  "/",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  getAllApplications
);

// Create a new application — allowed for agent/admin/customer
router.post(
  "/create",
  authenticateToken,
  authorizeRoles("agent", "admin", "customer"),
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

// Visa Application Endpoints
// Customer submits a new visa application
router.post(
  "/visa",
  authenticateToken,
  authorizeRoles("customer"),
  createVisaApplication
);
// Agent lists all visa applications
router.get(
  "/visa",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  getAllVisaApplications
);
// Agent views details of a visa application
router.get(
  "/visa/:id",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  getVisaApplicationById
);
// Agent approves/rejects a visa application
router.patch(
  "/visa/:id/approve",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  approveVisaApplication
);

router.get("/:appId", authenticateToken, getApplicationById);

export default router;
