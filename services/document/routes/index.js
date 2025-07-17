import express from "express";

import { authenticateToken } from "../../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../../middleware/roleMiddleware.js";
import {
  createDocument,
  updateDocumentStatus,
  getCustomerDocuments,
  getApplicationDocuments,
} from "../controllers/documentController.js";

import { upload } from "../middleware/multer.meddleware.js";

const router = express.Router();

router.post(
  "/create-document",
  authenticateToken,
  authorizeRoles("customer", "agent", "admin"),
  upload.single("file"),
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

// Add required documents endpoint
router.get(
  "/required",
  authenticateToken,
  authorizeRoles("customer", "agent", "admin"),
  (req, res) => {
    // You can later move this to a config or DB
    res.json({
      requiredDocuments: [
        {
          type: "passport",
          title: "Passport",
          description: "Valid passport with at least 6 months validity",
          required: true,
        },
        {
          type: "passport-photo",
          title: "Passport Photo",
          description: "Recent passport-sized photograph",
          required: true,
        },
        {
          type: "proof-of-address",
          title: "Proof of Address",
          description: "Utility bill or bank statement not older than 3 months",
          required: true,
        },
        {
          type: "source-of-funds",
          title: "Source of Funds",
          description: "Bank statements or proof of income",
          required: true,
        },
      ],
    });
  }
);

export default router;
