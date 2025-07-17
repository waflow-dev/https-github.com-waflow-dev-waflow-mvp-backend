import Application from "../../application/models/applicationModel.js";
import Agent from "../../user/models/agentModel.js";
import Customer from "../../user/models/customerModel.js";
import Document from "../../document/models/documentVaultModel.js";

export const getAdminDashboard = async (req, res) => {
  try {
    const totalAgents = await Agent.countDocuments();
    const totalCustomers = await Customer.countDocuments();
    const totalApplications = await Application.countDocuments();

    const statuses = await Application.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      totalAgents,
      totalCustomers,
      totalApplications,
      applicationStatusCounts: statuses,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to load admin dashboard", error: err.message });
  }
};

export const getAgentDashboard = async (req, res) => {
  const { agentId } = req.params;
  try {
    if (req.user.id !== agentId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    const assignedCustomers = await Customer.find({ assignedAgentId: agentId });
    const customerIds = assignedCustomers.map((c) => c._id);

    const applications = await Application.find({
      customer: { $in: customerIds },
    });

    const statusCounts = {};
    applications.forEach((app) => {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
    });

    res.status(200).json({
      agentId,
      totalCustomers: assignedCustomers.length,
      applications: statusCounts,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to load agent dashboard", error: err.message });
  }
};

export const getCustomerDashboard = async (req, res) => {
  const { customerId } = req.params;
  try {
    if (req.user.id !== customerId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    const application = await Application.findOne({ customer: customerId });
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    const documents = await Document.find({ linkedTo: customerId });

    res.status(200).json({
      applicationStatus: application.status,
      steps: application.steps,
      sharedNote: application.sharedNote || null,
      documents,
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to load customer dashboard",
      error: err.message,
    });
  }
};

export const getCustomerDocuments = async (req, res) => {
  const { customerId } = req.params;

  try {
    const documents = await Document.find({ linkedTo: customerId });

    if (!documents || documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No documents found for this customer",
      });
    }

    res.status(200).json({
      success: true,
      documents,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching customer documents",
      error: err.message,
    });
  }
};
