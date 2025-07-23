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
      "Awaiting Client Response",
    ],
    default: "Not Started",
  },
  updatedAt: { type: Date, default: Date.now },
});

const visaSubStepSchema = new mongoose.Schema({
  memberId: { type: String },
  status: {
    type: String,
    enum: ["Submitted for Review", "Approved", "Rejected"],
    default: "Submitted for Review",
  },
  updatedAt: { type: Date, default: Date.now },
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
        "Awaiting Client Response",
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
