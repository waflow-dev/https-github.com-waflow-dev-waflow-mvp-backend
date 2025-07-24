import Application from "../models/applicationModel.js";
import Customer from "../../user/models/customerModel.js";
import { logAction } from "../../audit logs/utils/logHelper.js";
import workflowConfig from "../utils/workflowConfig.js";
import { stepDocumentMap } from "../utils/stepDocumentMap.js";
import Document from "../../document/models/documentVaultModel.js";

export const autoApproveStepsIfDocsValid = async (customerId) => {
  const application = await Application.findOne({ customer: customerId });
  if (!application) return;

  const approvedDocs = await Document.find({
    $or: [
      { linkedTo: customerId, linkedModel: "Customer" },
      { linkedTo: application._id, linkedModel: "Application" },
    ],
    status: "Approved",
  });

  // Grouping by relatedStepName
  const stepwiseDocs = {};
  approvedDocs.forEach((doc) => {
    if (!stepwiseDocs[doc.relatedStepName]) {
      stepwiseDocs[doc.relatedStepName] = [];
    }
    stepwiseDocs[doc.relatedStepName].push(doc.documentType);
  });

  let updated = false;
  const updatedSteps = [];

  for (const step of application.steps) {
    const requiredByMap = stepDocumentMap[step.stepName] || [];
    const relatedDocs = stepwiseDocs[step.stepName] || [];

    const allApproved =
      requiredByMap.length === 0 ||
      requiredByMap.every((docType) => relatedDocs.includes(docType));

    if (
      allApproved &&
      step.status !== "Approved" &&
      (relatedDocs.length > 0 || requiredByMap.length > 0)
    ) {
      step.status = "Approved";
      step.updatedAt = new Date();
      updated = true;
      updatedSteps.push(step.stepName);
    }
  }

  if (updated) {
    application.status = calculateApplicationStatus(application.steps);
    await application.save();
    console.log("✅ Auto-approved steps:", updatedSteps);
  }
};

// ✅ FINAL VERSION — Shared across all controllers
const calculateApplicationStatus = (steps) => {
  const total = steps.length;
  const approved = steps.filter((s) => s.status === "Approved").length;
  const rejected = steps.some((s) => s.status === "Rejected");
  const submitted = steps.some((s) => s.status === "Submitted for Review");

  if (rejected) return "Rejected";
  if (approved === total) return "Completed";
  if (submitted || approved > 0) return "In Progress";
  if (steps.every((s) => s.status === "Not Started"))
    return "Ready for Processing";

  return "Waiting for Agent Review";
};

export const createApplication = async (req, res) => {
  const { customerId, assignedAgentId } = req.body;

  try {
    const existing = await Application.findOne({ customer: customerId });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Application already exists for this customer." });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const jurisdiction = customer.jurisdiction?.toLowerCase();
    const stepsFromConfig = workflowConfig[jurisdiction];

    if (!stepsFromConfig) {
      return res
        .status(400)
        .json({ message: "Workflow steps not defined for jurisdiction" });
    }

    const steps = stepsFromConfig.map((step) => ({
      stepName: step,
      status: "Not Started",
      updatedAt: new Date(),
    }));

    const application = await Application.create({
      customer: customerId,
      assignedAgent: assignedAgentId,
      steps,
      status: "New",
    });

    await logAction({
      type: "application",
      action: "application_created",
      performedBy: req.user.id,
      targetUser: customerId,
      details: { assignedAgent: assignedAgentId },
    });

    res
      .status(201)
      .json({ message: "Application created successfully", application });
  } catch (err) {
    console.error("Application creation error:", err);
    res.status(500).json({
      message: "Server error while creating application",
      error: err.message,
    });
  }
};

// PATCH: update step status
export const updateStepStatus = async (req, res) => {
  const { customerId } = req.params;
  const { stepName, status } = req.body;

  try {
    const application = await Application.findOne({ customer: customerId });
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    const stepIndex = application.steps.findIndex(
      (s) => s.stepName === stepName
    );
    if (stepIndex === -1)
      return res.status(400).json({ message: "Step not found" });

    application.steps[stepIndex].status = status;
    application.steps[stepIndex].updatedAt = new Date();

    // Auto-update application status
    application.status = calculateApplicationStatus(application.steps);

    await application.save();

    const updatedStatus = status;

    await logAction({
      type: "application",
      action: "step_status_updated",
      performedBy: req.user.id,
      details: {
        customer: customerId,
        step: stepName,
        newStatus: updatedStatus,
      },
    });

    res.status(200).json({
      message: `Step "${stepName}" updated successfully`,
      application,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error updating step",
      error: err.message,
    });
  }
};

export const addNote = async (req, res) => {
  const { appId } = req.params;
  const { message } = req.body;

  try {
    const application = await Application.findOne({ appId });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    application.notes.push({
      message,
      addedBy: application.customer,
      timestamp: new Date(),
    });

    await application.save();

    res.status(200).json({
      message: "Note added successfully",
      notes: application.notes,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error adding note",
      error: err.message,
    });
  }
};

export const addVisaMember = async (req, res) => {
  const { cutomerId } = req.params;
  const { memberId } = req.body;

  try {
    const application = await Application.findOne({ customer: cutomerId });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Prevent duplicate member entries
    const exists = application.visaSubSteps.find(
      (v) => v.memberId && v.memberId.toString() === memberId
    );
    if (exists) {
      return res.status(400).json({ message: "Member already added" });
    }

    // Add member without documents
    const newMember = {
      memberId,
      status: "Submitted for Review",
      updatedAt: new Date(),
    };

    application.visaSubSteps.push(newMember);
    await application.save();

    res.status(201).json({
      message: "Visa member added successfully",
      visaSubSteps: application.visaSubSteps,
    });
  } catch (err) {
    console.error("Visa member add error:", err);
    res.status(500).json({
      message: "Error adding visa member",
      error: err.message,
    });
  }
};

export const updateVisaMemberStatus = async (req, res) => {
  const { appId, memberId } = req.params;
  const { status } = req.body;

  try {
    const application = await Application.findById(appId);
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    const member = application.visaSubSteps.find(
      (m) => m.memberId && m.memberId.toString() === memberId
    );

    if (!member)
      return res.status(404).json({ message: "Visa member not found" });

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    member.status = status;
    member.updatedAt = new Date();

    await application.save();

    res.status(200).json({
      message: `Visa member marked as ${status}`,
      visaSubSteps: application.visaSubSteps,
    });
  } catch (err) {
    console.error("Error updating visa member:", err);
    res.status(500).json({
      message: "Error updating visa member status",
      error: err.message,
    });
  }
};

export const getVisaMemberDocuments = async (req, res) => {
  const { customerId, memberId } = req.params;

  try {
    const documents = await Document.find({
      linkedModel: "Customer",
      linkedTo: customerId,
      memberId: memberId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (err) {
    console.error("Error fetching visa documents:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch visa member documents",
      error: err.message,
    });
  }
};

export const getVisaMembersByCustomer = async (req, res) => {
  const { customerId } = req.params;

  try {
    const application = await Application.findOne({ customer: customerId });

    if (!application) {
      return res
        .status(404)
        .json({ message: "Application not found for this customer" });
    }

    res.status(200).json({
      success: true,
      visaMembers: application.visaSubSteps,
    });
  } catch (err) {
    console.error("Error fetching visa members:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch visa members",
      error: err.message,
    });
  }
};

export const updateOnboardingDetails = async (req, res) => {
  const { customerId } = req.params;
  const body = req.body;

  console.log("customerId put: ", customerId);

  const updateFields = {
    firstName: body.customerName?.split(" ")[0] || "",
    middleName: body.customerName?.split(" ")[1] || "",
    lastName: body.customerName?.split(" ").slice(2).join(" ") || "",
    dob: body.dateOfBirth,
    email: body.emailAddress,
    phoneNumber: body.phoneNumber,
    nationality: body.nationality,
    gender: body.gender,
    permanentAddress: body.permanentAddress,
    currentAddress: body.localAddress,
    countryOfResidence: body.countryOfResidence,
    sourceOfFund: body.sourceOfFund,
    quotedPrice: body.quotedPrice,
    paymentDetails: body.paymentDetails,
    companyType: body.companyTypePreference,
    jurisdiction: body.companyJurisdiction,
    businessActivity1: body.businessActivity[0] || "",
    officeType: body.officeType,
    numberOfInvestors: Number(body.numberOfInvestors) || 1,
    role: body.role,
  };

  try {
    const customer = await Customer.findByIdAndUpdate(
      customerId,
      updateFields,
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // ✅ Update application status
    await Application.findOneAndUpdate(
      { customer: customerId },
      { status: "Waiting for Agent Review", sharedNote: null }
    );

    // ✅ Optional Optimization: Trigger auto-approval after onboarding
    await autoApproveStepsIfDocsValid(customerId);

    const updatedApp = await Application.findOne({ customer: customerId });

    res.status(200).json({
      success: true,
      message: "Onboarding details submitted successfully",
      data: customer,
      applicationStatus: updatedApp?.status || "Waiting for Agent Review",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error updating onboarding info",
      error: err.message,
    });
  }
};

export const reviewApplication = async (req, res) => {
  const { applicationId } = req.params;
  const { decision, note } = req.body;

  try {
    if (!["approve", "clarify"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision type" });
    }

    const updated = await Application.findByIdAndUpdate(
      applicationId,
      {
        status:
          decision === "approve"
            ? "Ready for Processing"
            : "Awaiting Client Response",
        sharedNote: decision === "clarify" ? note : undefined,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Application not found" });
    }

    await logAction({
      type: "application",
      action: "application_reviewed",
      performedBy: req.user.id,
      details: { status: decision },
    });

    res.status(200).json({
      success: true,
      message:
        decision === "approve"
          ? "Application marked as Ready for Processing"
          : "Clarification requested from customer",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error during application review",
      error: err.message,
    });
  }
};

export const getApplicationById = async (req, res) => {
  const { appId } = req.params;

  const user = req.user;

  console.log("Fetching application for user:", user);

  try {
    const application = await Application.findById(appId)
      .populate("customer")
      .populate("assignedAgent")
      .populate("visaSubSteps.memberId")
      .populate("notes.addedBy");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    res.status(200).json({
      success: true,
      data: application,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching application",
      error: err.message,
    });
  }
};

export const getApplicationByCustomerId = async (req, res) => {
  const { customerId } = req.params;

  const user = req.user;

  console.log("Fetching application for user:", user);

  try {
    const application = await Application.findOne({ customer: customerId })
      .populate("customer")
      .populate("assignedAgent")
      .populate("visaSubSteps")
      .populate("notes.addedBy");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    res.status(200).json({
      success: true,
      data: application,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching application",
      error: err.message,
    });
  }
};

export const getAllApplications = async (req, res) => {
  try {
    const { role, id: userId, userId: altUserId } = req.user;

    let query = {};

    // If user is an agent, only show applications assigned to them
    if (role === "agent") {
      // Use userId (matches assignedAgent in DB)
      const agentId = req.user.userId?.toString() || req.user.id?.toString();
      query.assignedAgent = agentId;
    }
    // If user is admin, show all applications
    const applications = await Application.find(query)
      .populate("customer", "firstName lastName email phoneNumber")
      .populate("assignedAgent", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: applications,
    });
  } catch (error) {
    console.error("[DEBUG] Error in getAllApplications:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching applications",
      error: error.message,
    });
  }
};

export const showApplicationWithStatus = async (req, res) => {
  const { customerId } = req.params;

  try {
    const customer = await Customer.findById(customerId).lean();
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const application = await Application.findOne({
      customer: customerId,
    }).lean();
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Get all documents uploaded by this customer
    const documents = await Document.find({
      linkedTo: customerId,
      linkedModel: "Customer",
    }).lean();

    // Attach documents to their related steps
    const stepDetails = application.steps.map((step) => {
      const stepDocs = documents.filter(
        (doc) => doc.relatedStepName === step.stepName
      );
      return {
        stepName: step.stepName,
        status: step.status,
        updatedAt: step.updatedAt,
        documents: stepDocs.map((doc) => ({
          documentName: doc.documentName,
          documentType: doc.documentType,
          status: doc.status,
          fileUrl: doc.fileUrl,
          expiryDate: doc.expiryDate,
        })),
      };
    });

    res.status(200).json({
      success: true,
      message: "Application status fetched successfully",
      data: {
        applicationId: application._id,
        customerId,
        customerName: `${customer.firstName} ${customer.lastName}`,
        status: application.status,
        steps: stepDetails,
      },
    });
  } catch (err) {
    console.error("Error fetching application status:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch application status",
      error: err.message,
    });
  }
};

export const reviewApplicationAfterOnboarding = async (req, res) => {
  const { applicationId } = req.params;
  const { decision, note } = req.body; // decision = "approve" or "clarify"

  try {
    // Validate input
    if (!["approve", "clarify"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision type" });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Determine status change
    application.status =
      decision === "approve"
        ? "Ready for Processing"
        : "Awaiting Client Response";

    // Store note if clarification requested
    if (decision === "clarify") {
      application.sharedNote = note || "Agent requested clarification.";
    }

    await application.save();

    await logAction({
      type: "application",
      action: "review_after_onboarding",
      performedBy: req.user.id,
      details: {
        applicationId,
        newStatus: application.status,
        note: decision === "clarify" ? note : undefined,
      },
    });

    res.status(200).json({
      success: true,
      message:
        decision === "approve"
          ? "Application marked as Ready for Processing"
          : "Clarification requested from customer",
      applicationStatus: application.status,
    });
  } catch (err) {
    console.error("Review error:", err);
    res.status(500).json({
      success: false,
      message: "Error reviewing application",
      error: err.message,
    });
  }
};
