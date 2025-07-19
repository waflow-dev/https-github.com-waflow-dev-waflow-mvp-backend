import mongoose from "mongoose";

const stepSchema = new mongoose.Schema({
  stepName: { type: String, required: true },
  status: {
    type: String,
    enum: [
      "Not Started",
      "Started",
      "Submitted for Review",
      "Awaiting Response",
      "Approved",
      "Declined",
      "Skipped",
    ],
    default: "Not Started",
  },
  updatedAt: { type: Date, default: Date.now },
});

const visaSubStepSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  medical: {
    type: stepSchema,
    default: () => ({ stepName: "Medical & Biometric" }),
  },
  residenceVisa: {
    type: stepSchema,
    default: () => ({ stepName: "Residence Visa" }),
  },
  emiratesIdSoft: {
    type: stepSchema,
    default: () => ({ stepName: "Emirates ID (Soft Copy)" }),
  },
  emiratesIdHard: {
    type: stepSchema,
    default: () => ({ stepName: "Emirates ID (Hard Copy)" }),
  },
});

const noteSchema = new mongoose.Schema({
  message: String,
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Agent" },
  timestamp: { type: Date, default: Date.now },
});

const applicationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: "Agent" },
    status: {
      type: String,
      enum: [
        "New",
        "Waiting for Agent Review",
        "Ready for Processing",
        "In Progress",
        "Completed",
        "Rejected",
      ],
      default: "New",
    },
    steps: [stepSchema],
    sharedNote: { type: String },
    visaSubSteps: [visaSubStepSchema],
    notes: [noteSchema],
    isLocked: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Application", applicationSchema);
