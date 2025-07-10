import mongoose from "mongoose";

const documentVaultSchema = new mongoose.Schema(
  {
    documentName: { type: String, required: true },
    documentType: { type: String, required: true },

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

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    uploadedBy: String,
    expiryDate: Date,
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model("DocumentVault", documentVaultSchema);
