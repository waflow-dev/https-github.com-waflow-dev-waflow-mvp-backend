import Application from "../models/applicationModel.js";
import Customer from "../../user/models/customerModel.js";
import { logAction } from "../../audit logs/utils/logHelper.js";
import workflowConfig from "../utils/workflowConfig.js";
import { stepDocumentMap } from "../utils/stepDocumentMap.js";
import Document from "../../document/models/documentVaultModel.js";

export const autoApproveStepsIfDocsValid = async (customerId) => {
  const application = await Application.findOne({ customer: customerId });
  if (!application) return;

  const customerDocs = await Document.find({
    linkedTo: customerId,
    status: "Approved",
  });

  const docTypesApproved = customerDocs.map((doc) => doc.documentType);

  const stepsToUpdate = [];

  for (const step of application.steps) {
    const requiredDocs = stepDocumentMap[step.stepName] || [];
    const allApproved = requiredDocs.every((doc) =>
      docTypesApproved.includes(doc)
    );

    if (requiredDocs.length > 0 && allApproved && step.status !== "Approved") {
      step.status = "Approved";
      step.updatedAt = new Date();
      stepsToUpdate.push(step.stepName);
    }
  }

  if (stepsToUpdate.length > 0) {
    await application.save();
    console.log(`✅ Auto-approved steps: ${stepsToUpdate.join(", ")}`);
  }
};

// Helper: auto-update global status
const calculateApplicationStatus = (steps) => {
  const total = steps.length;
  const approved = steps.filter((s) => s.status === "Approved").length;
  const started = steps.some((s) => s.status === "Started");
  const declined = steps.some((s) => s.status === "Declined");

  if (declined) return "Rejected";
  if (approved === total) return "Completed";
  if (started) return "In Progress";
  if (steps.every((s) => s.status === "Not Started"))
    return "Ready for Processing";
  return "Waiting for Agent Review";
};

// Controller: Create new application
export const createApplication = async (req, res) => {
  const { customerId, assignedAgentId } = req.body;

  try {
    // Check duplicate application
    const existing = await Application.findOne({ customer: customerId });
    if (existing) {
      return res.status(400).json({
        message: "Application already exists for this customer.",
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const jurisdiction = customer.jurisdiction?.toLowerCase();
    const stepsFromConfig = workflowConfig[jurisdiction];

    if (!stepsFromConfig) {
      return res.status(400).json({
        message: "Jurisdiction-specific workflow not found.",
      });
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

    res.status(201).json({
      message: "Application created successfully",
      application,
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error while creating application",
      error: err.message,
    });
  }
};

// PATCH: update step status
export const updateStepStatus = async (req, res) => {
  const { appId } = req.params;
  const { stepName, status } = req.body;

  try {
    const application = await Application.findById(appId);
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
        applicationId: appId,
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
  const { message, addedBy } = req.body; // addedBy = agent ID

  try {
    const application = await Application.findById(appId);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    application.notes.push({
      message,
      addedBy,
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
  const { appId } = req.params;
  const { memberId } = req.body;

  try {
    const application = await Application.findById(appId);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const exists = application.visaSubSteps.find(
      (v) => v.memberId.toString() === memberId
    );
    if (exists) {
      return res.status(400).json({ message: "Member already added" });
    }

    const newMember = {
      memberId,
      medical: {
        stepName: "Medical & Biometric",
        status: "Not Started",
        updatedAt: new Date(),
      },
      residenceVisa: {
        stepName: "Residence Visa",
        status: "Not Started",
        updatedAt: new Date(),
      },
      emiratesIdSoft: {
        stepName: "Emirates ID (Soft Copy)",
        status: "Not Started",
        updatedAt: new Date(),
      },
      emiratesIdHard: {
        stepName: "Emirates ID (Hard Copy)",
        status: "Not Started",
        updatedAt: new Date(),
      },
    };

    application.visaSubSteps.push(newMember);
    await application.save();

    res.status(201).json({
      message: "Visa member added successfully",
      visaSubSteps: application.visaSubSteps,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error adding visa member",
      error: err.message,
    });
  }
};

export const updateVisaSubStep = async (req, res) => {
  const { appId, memberId } = req.params;
  const { subStepName, status } = req.body;

  try {
    const application = await Application.findById(appId);
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    const member = application.visaSubSteps.find(
      (m) => m.memberId.toString() === memberId
    );
    if (!member) return res.status(404).json({ message: "Member not found" });

    // Proper mapping from readable name to member keys
    const keyMap = {
      medical: "medical",
      "residence visa": "residenceVisa",
      "emirates id (soft copy)": "emiratesIdSoft",
      "emirates id (hard copy)": "emiratesIdHard",
    };

    const normalized = subStepName.trim().toLowerCase();
    const key = keyMap[normalized];

    if (!key || !member[key]) {
      return res.status(400).json({ message: "Invalid subStepName" });
    }

    // Update substep
    member[key].status = status;
    member[key].updatedAt = new Date();

    // ✅ Check if ALL members completed all substeps
    const allMembersDone = application.visaSubSteps.every((m) => {
      return (
        m.medical.status === "Approved" &&
        m.residenceVisa.status === "Approved" &&
        m.emiratesIdSoft.status === "Approved" &&
        m.emiratesIdHard.status === "Approved"
      );
    });

    if (allMembersDone) {
      const visaStep = application.steps.find(
        (s) => s.stepName === "Visa Application"
      );
      if (visaStep && visaStep.status !== "Approved") {
        visaStep.status = "Approved";
        visaStep.updatedAt = new Date();
      }
    }

    application.status = calculateApplicationStatus(application.steps);
    await application.save();

    res.status(200).json({
      message: `${subStepName} updated successfully`,
      visaSubSteps: application.visaSubSteps,
      applicationStatus: application.status,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error updating visa substep",
      error: err.message,
    });
  }
};

export const updateOnboardingDetails = async (req, res) => {
  const { customerId } = req.params;
  const body = req.body;

  console.log('customerId put: ', customerId);
  

  // Map frontend fields to backend model
  const updateFields = {
    // Personal Details
    firstName: body.customerName?.split(' ')[0] || '',
    middleName: body.customerName?.split(' ')[1] || '',
    lastName: body.customerName?.split(' ').slice(2).join(' ') || '',
    dob: body.dateOfBirth,
    email: body.emailAddress,
    phoneNumber: body.phoneNumber,
    nationality: body.nationality,
    gender: body.gender,
    // Address
    permanentAddress: body.permanentAddress,
    currentAddress: body.localAddress,
    countryOfResidence: body.countryOfResidence,
    // Passport & ID
    // (Assume passportPhoto and localProof are handled as uploads elsewhere)
    // Financials
    sourceOfFund: body.sourceOfFund,
    quotedPrice: body.quotedPrice,
    paymentDetails: body.paymentDetails,
    // Company Details
    companyType: body.companyTypePreference,
    jurisdiction: body.companyJurisdiction,
    businessActivity1: body.businessActivity[0] || '',
    officeType: body.officeType,
    // Investor Info
    numberOfInvestors: Number(body.numberOfInvestors) || 1,
    role: body.role,
    // Optionally add more fields as needed
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

    // update application status
    await Application.findOneAndUpdate(
      { customer: customerId },
      { status: "Waiting for Agent Review", sharedNote: null }
    );

    res.status(200).json({
      success: true,
      message: "Onboarding details submitted successfully",
      data: customer,
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

export const getAllApplications = async (req, res) => {
  try {
    console.log('[DEBUG] getAllApplications called');
    console.log('[DEBUG] req.user:', req.user);
    
    const { role, id: userId, userId: altUserId } = req.user;
    console.log('[DEBUG] role:', role);
    console.log('[DEBUG] userId:', userId);
    console.log('[DEBUG] altUserId:', altUserId);
    
    let query = {};
    
    // If user is an agent, only show applications assigned to them
    if (role === 'agent') {
      const agentId = userId || altUserId;
      console.log('[DEBUG] agentId for query:', agentId);
      query.assignedAgent = agentId;
    }
    // If user is admin, show all applications
    
    console.log('[DEBUG] query:', query);
    
    const applications = await Application.find(query)
      .populate('customer', 'firstName lastName email phoneNumber')
      .populate('assignedAgent', 'fullName email')
      .sort({ createdAt: -1 });

    console.log('[DEBUG] Found applications:', applications.length);
    console.log('[DEBUG] Applications:', applications);

    res.status(200).json({
      success: true,
      data: applications,
    });
  } catch (error) {
    console.error('[DEBUG] Error in getAllApplications:', error);
    res.status(500).json({
      success: false,
      message: "Error fetching applications",
      error: error.message,
    });
  }
};
