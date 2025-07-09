import mongoose from "mongoose";

const agentSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Agent" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Agent", agentSchema);
