import express from "express";

import { authenticateToken } from "../../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../../middleware/roleMiddleware.js";
import {
  createDocument,
  updateDocumentStatus,
  getCustomerDocuments,
  getApplicationDocuments,
} from "../controllers/documentController.js";

const router = express.Router();

router.post(
  "/create-document",
  authenticateToken,
  authorizeRoles("customer", "agent", "admin"),
  createDocument
);
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  updateDocumentStatus
);
router.get(
  "/customer/:customerId",
  authenticateToken,
  authorizeRoles("customer", "agent", "admin"),
  getCustomerDocuments
);
router.get(
  "/application/:appId",
  authenticateToken,
  authorizeRoles("agent", "admin"),
  getApplicationDocuments
);

export default router;
