import VisaApplication from "../models/visaApplicationModel.js";
import Application from "../models/applicationModel.js";
import Customer from "../../user/models/customerModel.js";
import DocumentVault from "../../document/models/documentVaultModel.js";
import mongoose from "mongoose";

// Customer submits a new visa application
export const createVisaApplication = async (req, res) => {
  const user = req.user;

  try {
    const { customerId, members, documentIds } = req.body;
    // Validate memberId and documents
    if (
      !members ||
      !Array.isArray(members) ||
      members.length === 0 ||
      !members[0].memberId
    ) {
      return res.status(400).json({ message: "memberId is required" });
    }
    // Validate memberId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(members[0].memberId)) {
      return res
        .status(400)
        .json({ message: "memberId must be a valid ObjectId" });
    }
    if (
      !documentIds ||
      !Array.isArray(documentIds) ||
      documentIds.length !== 3
    ) {
      return res
        .status(400)
        .json({ message: "Exactly three documents are required" });
    }
    const customer = await Customer.findById(customerId || req.user.userId);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });
    // Create visa application
    const visaApp = await VisaApplication.create({
      customer: user.userId,
      members: members.map((m) => ({ memberId: m.memberId })),
      documents: documentIds,
      status: "Submitted",
    });
    res.status(201).json({ success: true, data: visaApp });
  } catch (err) {
    console.error("[VisaApp] Error:", err);
    res.status(500).json({
      success: false,
      message: "Error creating visa application",
      error: err.message,
      stack: err.stack,
    });
  }
};

// Agent lists all submitted visa applications
export const getAllVisaApplications = async (req, res) => {
  try {
    const visaApps = await VisaApplication.find()
      .populate("application")
      .populate("customer")
      .populate("documents");
    res.status(200).json({ success: true, data: visaApps });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching visa applications",
      error: err.message,
    });
  }
};

// Agent views details of a visa application
export const getVisaApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const visaApp = await VisaApplication.findById(id)
      .populate("application")
      .populate("customer")
      .populate("documents");
    if (!visaApp)
      return res.status(404).json({ message: "Visa application not found" });
    res.status(200).json({ success: true, data: visaApp });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching visa application",
      error: err.message,
    });
  }
};

// Agent approves/rejects a visa application
export const approveVisaApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, agentNote } = req.body;
    if (!["Approved", "Rejected", "In Review"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const visaApp = await VisaApplication.findByIdAndUpdate(
      id,
      { status, agentNote },
      { new: true }
    );
    if (!visaApp)
      return res.status(404).json({ message: "Visa application not found" });
    res.status(200).json({ success: true, data: visaApp });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error updating visa application",
      error: err.message,
    });
  }
};

// Customer fetches their own visa applications
export const getVisaApplicationsForCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    // Only allow if the requester is the customer or an admin
    if (
      req.user.role !== "admin" &&
      req.user.userId?.toString() !== customerId &&
      req.user.id?.toString() !== customerId
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const visaApps = await VisaApplication.find({ customer: customerId })
      .populate("application")
      .populate("customer")
      .populate("documents");
    res.status(200).json({ success: true, data: visaApps });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching visa applications for customer",
      error: err.message,
    });
  }
};
