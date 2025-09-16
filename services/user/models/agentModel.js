import mongoose from "mongoose";

const agentSchema = new mongoose.Schema({
  agentId: { type: String, unique: true }, // e.g. AG-0001
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  createdAt: { type: Date, default: Date.now },
  role: { type: String, default: "agent" },
});

export default mongoose.model("Agent", agentSchema);
