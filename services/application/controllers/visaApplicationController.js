import VisaApplication from "../models/visaApplicationModel.js";
import Application from "../models/applicationModel.js";
import Customer from "../../user/models/customerModel.js";
import DocumentVault from "../../document/models/documentVaultModel.js";

// Customer submits a new visa application
export const createVisaApplication = async (req, res) => {
  try {
    console.log("[DEBUG] VisaApplication request body:", req.body);
    const { applicationId, customerId, members, documentIds } = req.body;
    // Use customerId from body if present, else from req.user
    const customer = await Customer.findById(customerId || req.user.userId);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });
    let application = null;
    if (applicationId) {
      application = await Application.findById(applicationId);
      if (!application)
        return res.status(404).json({ message: "Application not found" });
    }
    // Create visa application
    const visaApp = await VisaApplication.create({
      ...(applicationId ? { application: applicationId } : {}),
      customer: customer._id,
      members,
      documents: documentIds,
      status: "Submitted",
    });
    res.status(201).json({ success: true, data: visaApp });
  } catch (err) {
    console.error("[DEBUG] Error creating visa application:", err);
    res.status(500).json({
      success: false,
      message: "Error creating visa application",
      error: err.message,
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
