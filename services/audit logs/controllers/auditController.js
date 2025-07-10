import AuditLog from "../models/auditLogModel.js";
import mongoose from "mongoose";

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id) &&
  String(new mongoose.Types.ObjectId(id)) === id;

export const createLog = async (req, res) => {
  try {
    const data = { ...req.body };

    if (data.performedBy && isValidObjectId(data.performedBy)) {
      data.performedBy = new mongoose.Types.ObjectId(data.performedBy);
    } else {
      data.performedBy = undefined; // or remove entirely
    }

    if (data.targetUser && isValidObjectId(data.targetUser)) {
      data.targetUser = new mongoose.Types.ObjectId(data.targetUser);
    } else {
      data.targetUser = undefined;
    }

    const log = await AuditLog.create(data);
    res.status(201).json({ success: true, log });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Log failed", error: err.message });
  }
};

export const getLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
    res.status(200).json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
