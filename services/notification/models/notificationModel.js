import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "userRole", // Dynamically references Agent, Customer, or Manager
    },
    userRole: {
      type: String,
      enum: ["agent", "customer", "admin", "manager"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String }, // Optional (e.g. ApplicationUpdate, Reminder)
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    referenceType: {
      type: String, // Application, Task, etc.
      required: false,
    },
    status: {
      type: String,
      enum: ["Unread", "Read"],
      default: "Unread",
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
