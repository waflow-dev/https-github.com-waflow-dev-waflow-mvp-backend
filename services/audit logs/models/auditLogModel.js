import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["auth", "user", "application", "document", "system", "notification"],
    required: true,
  },
  action: { type: String, required: true }, // e.g. login, created, updated_status
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Auth",
    required: false,
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Auth",
    required: false,
  },
  details: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("AuditLog", auditLogSchema);
