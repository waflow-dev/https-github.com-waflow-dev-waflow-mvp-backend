// ✅ documentVaultModel.js — Supports flexible document linking with manual approval workflow

import mongoose from "mongoose";

const documentVaultSchema = new mongoose.Schema(
  {
    documentName: { type: String, required: true },

    // Type of document: e.g., "Passport", "MOA", "Lease", etc.
    documentType: {
      type: String,
      required: true,
    },

    // Related application step: e.g., "KYC & Background Check", "Visa Application"
    relatedStepName: {
      type: String,
      required: false,
    },

    linkedTo: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "linkedModel",
    },
    linkedModel: {
      type: String,
      required: true,
      enum: ["Customer", "Application"],
    },

    fileUrl: { type: String, required: true },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "uploadedByRole",
    },
    uploadedByRole: {
      type: String,
      enum: ["agent", "admin", "customer"],
      required: true,
    },
    uploadedByFullName: {
      type: String,
      required: false, // optional, but recommended so you always save it
    },

    expiryDate: Date,

    notes: [
      {
        message: String,
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "addedByRole",
          required: true,
        },
        addedByRole: {
          type: String,
          enum: ["agent", "admin", "customer"],
          required: true,
        },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("DocumentVault", documentVaultSchema);
