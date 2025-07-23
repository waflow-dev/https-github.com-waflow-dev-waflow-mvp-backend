import mongoose from "mongoose";

const visaMemberSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
});

const visaApplicationSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: false, // Make optional
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    members: [visaMemberSchema],
    documents: [{ type: mongoose.Schema.Types.ObjectId, ref: "DocumentVault" }],
    status: {
      type: String,
      enum: ["Submitted", "In Review", "Approved", "Rejected"],
      default: "Submitted",
    },
    agentNote: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("VisaApplication", visaApplicationSchema);
