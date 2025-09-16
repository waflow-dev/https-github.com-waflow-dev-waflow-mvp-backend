import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  adminId: { type: String, unique: true }, // e.g. ADM-0001
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String },
  department: { type: String },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  createdAt: { type: Date, default: Date.now },
  role: { type: String, default: "admin" },
});

export default mongoose.model("Admin", adminSchema);
