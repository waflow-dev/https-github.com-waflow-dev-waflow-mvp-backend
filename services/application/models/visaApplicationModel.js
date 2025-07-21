import mongoose from "mongoose";

const visaMemberSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  passportNumber: { type: String, required: true },
  nationality: { type: String, required: true },
  dob: { type: Date },
  emiratesId: { type: String },
  relationship: { type: String },
  // Add more fields as needed
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
