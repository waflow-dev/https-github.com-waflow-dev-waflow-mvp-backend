import express from "express";
import { authenticateToken } from "../../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../../middleware/roleMiddleware.js";
import {
  createApplication,
  updateStepStatus,
  addNote,
  reviewApplication,
  updateOnboardingDetails,
  getApplicationById,
  getAllApplications,
  showApplicationWithStatus,
  getApplicationByCustomerId,
  reviewApplicationAfterOnboarding,
  updateVisaMemberStatus,
  getVisaMemberDocuments,
  addVisaMember,
} from "../controllers/applicationController.js";
// import {
//   createVisaApplication,
//   getAllVisaApplications,
//   getVisaApplicationById,
//   approveVisaApplication,
// } from "../controllers/visaApplicationController.js";

const router = express.Router();

// Get all applications — allowed for agent/admin
router.get(
  "/",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  getAllApplications
);

router.get("/app/:customerId", authenticateToken, getApplicationByCustomerId);

// Create a new application — allowed for agent/admin/customer
router.post(
  "/create",
  authenticateToken,
  authorizeRoles("agent", "admin", "customer"),
  createApplication
);

// Update application step status — agent/admin/customer
router.patch(
  "/stepStatus/:customerId",
  authenticateToken,
  authorizeRoles("agent", "admin", "customer"),
  updateStepStatus
);

// Update workflow step status — agent/admin
router.patch(
  "/step/:appId",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  updateStepStatus
);

// Add note for clarification
router.post("/note/:customerId", authenticateToken, addNote);

router.post("/visa-member/:cutomerId", addVisaMember);

// Update visa substep status — agent/admin
router.patch(
  "/visa-substep/:appId/:memberId",
  // authenticateToken,
  // authorizeRoles("agent", "admin"),
  updateVisaMemberStatus
);

router.get("/:customerId/:memberId", getVisaMemberDocuments);

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
// router.post(
//   "/visa",
//   authenticateToken,
//   authorizeRoles("customer"),
//   createVisaApplication
// );
// // Agent lists all visa applications
// router.get(
//   "/visa",
//   authenticateToken,
//   authorizeRoles("agent", "admin"),
//   getAllVisaApplications
// );
// // Agent views details of a visa application
// router.get(
//   "/visa/:id",
//   authenticateToken,
//   authorizeRoles("agent", "admin"),
//   getVisaApplicationById
// );
// // Agent approves/rejects a visa application
// router.patch(
//   "/visa/:id/approve",
//   authenticateToken,
//   authorizeRoles("agent", "admin"),
//   approveVisaApplication
// );

router.patch(
  "/review-after-onboarding/:applicationId",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  reviewApplicationAfterOnboarding
);

router.get("/:appId", authenticateToken, getApplicationById);

router.get("/status/:customerId", authenticateToken, showApplicationWithStatus);

export default router;
