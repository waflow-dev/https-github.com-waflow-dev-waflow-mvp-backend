import Application from "../models/applicationModel.js";
import Customer from "../../user/models/customerModel.js";
import Agent from "../../user/models/agentModel.js";
import Admin from "../../user/models/adminModel.js";
import Auth from "../../auth/models/authModel.js";
import { logAction } from "../../audit logs/utils/logHelper.js";
import { createNotification } from "../../notification/controllers/notificationController.js";
import workflowConfig from "../utils/workflowConfig.js";
import Document from "../../document/models/documentVaultModel.js";

////////////////////////////////////////Helper Function////////////////////////////////////////////////////////////////

// ✅ Helper to determine app status
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

////////////////////////////////////////Create Application////////////////////////////////////////////////////////////////

export const createApplication = async (req, res) => {
  const {
    customerId,
    assignedAgent,
    assignedAgentRole,
    applicationType,
    emirate,
    legalForm,
    proposedCompanyNamesEN,
    proposedCompanyNameAR,
    officeRequired,
    officeType,
    totalAgreedCost,
    paymentEntries = [],
  } = req.body;

  try {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // const existing = await Application.findOne({ customer: customer._id });
    // if (existing) {
    //   return res
    //     .status(400)
    //     .json({ message: "Application already exists for this customer." });
    // }

    const stepsFromConfig = workflowConfig[applicationType?.toLowerCase()];

    if (!stepsFromConfig) {
      return res
        .status(400)
        .json({ message: "Workflow steps not defined for Application Type" });
    }

    const steps = stepsFromConfig.map((step) => ({
      stepName: step,
      status: "Not Started",
      updatedAt: new Date(),
    }));

    const appCount = await Application.countDocuments();
    const paddedNumber = String(appCount + 1).padStart(4, "0");
    const applicationId = `APP-${paddedNumber}`;

    const newApplication = await Application.create({
      applicationId,
      customer: customerId,
      assignedAgent,
      assignedAgentRole,
      applicationType,
      emirate,
      legalForm,
      proposedCompanyNamesEN,
      proposedCompanyNameAR,
      officeRequired,
      officeType,
      totalAgreedCost,
      paymentEntries,
      steps,
    });

    await logAction({
      type: "application",
      action: "application_created",
      performedBy: req.user.id,
      targetUser: customerId,
      details: { applicationId },
    });

    await createNotification({
      userId: customerId,
      userRole: "customer",
      title: "Application Created",
      message: `Your application (${applicationId}) has been created.`,
      type: "application",
      referenceId: newApplication._id,
      referenceType: "Application",
    });

    res.status(201).json({
      success: true,
      message: "Application created successfully",
      data: newApplication,
    });
  } catch (err) {
    console.error("Error creating application:", err);
    res.status(500).json({
      success: false,
      message: "Server error while creating application",
      error: err.message,
    });
  }
};

////////////////////////////////////////Update Application////////////////////////////////////////////////////////////////

export const updateOnboardingDetails = async (req, res) => {
  const { applicationId } = req.params;
  const {
    businessActivities,
    numberOfShareholders,
    basicInvestment,
    sponsorRequired,
    sponsorDetails,
    shareholderDetails,
  } = req.body;

  try {
    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // ❌ Prevent update if locked
    if (application.isLocked) {
      return res.status(403).json({
        message: "Application is locked and cannot be edited by the customer",
      });
    }

    // ⚙️ Update only the customer-editable fields
    if (businessActivities) application.businessActivities = businessActivities;
    if (numberOfShareholders !== undefined)
      application.numberOfShareholders = numberOfShareholders;
    if (basicInvestment !== undefined)
      application.basicInvestment = basicInvestment;
    if (sponsorRequired !== undefined)
      application.sponsorRequired = sponsorRequired;
    if (sponsorDetails) application.sponsorDetails = sponsorDetails;
    if (shareholderDetails) application.shareholderDetails = shareholderDetails;

    // 🧠 Update status & save
    application.status = "Waiting for Agent Review";
    await application.save();

    const customerAuth = await Auth.findOne({
      userId: application.customer,
      role: "customer",
    }).select("_id");

    // 🛎️ Notify agent/admin
    await createNotification({
      userId: application.assignedAgent,
      userRole: application.assignedAgentRole,
      title: "Onboarding Submitted",
      message: `${customerAuth.firstName} has submitted their onboarding form.`,
      type: "application",
      referenceId: application._id,
      referenceType: "Application",
    });

    // 📓 Log action
    await logAction({
      type: "application",
      action: "onboarding_submitted",
      performedBy: req.user.id,
      targetUser: customerAuth?._id || null,
      details: {
        applicationId: application._id,
        fieldsUpdated: Object.keys(req.body),
      },
    });

    res.status(200).json({
      success: true,
      message: "Application onboarding details submitted successfully.",
      data: application,
    });
  } catch (err) {
    console.error("Error in updateOnboardingDetails:", err);
    res.status(500).json({
      success: false,
      message: "Failed to submit onboarding details",
      error: err.message,
    });
  }
};

export const updateApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const updateFields = req.body;

    // 1. Fetch application
    const application = await Application.findOne({ applicationId });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (application.isLocked) {
      return res.status(403).json({
        message: "Application is locked and cannot be edited",
      });
    }

    // 2. Apply updates from request body (agent/admin-level fields only)
    const allowedFields = [
      "applicationType",
      "emirate",
      "legalForm",
      "proposedCompanyNamesEN",
      "proposedCompanyNameAR",
      "officeRequired",
      "officeType",
      "applicationNotes",
      "totalAgreedCost",
      "paymentEntries", // Repeatable group
      "status",
      "assignedAgent",
      "assignedAgentRole",
    ];

    for (let key of allowedFields) {
      if (updateFields[key] !== undefined) {
        application[key] = updateFields[key];
      }
    }

    await application.save();

    const customerAuth = await Auth.findOne({
      userId: application.customer,
      role: "customer",
    }).select("_id");

    // 3. Log action
    await logAction({
      type: "application",
      action: "application_updated_by_agent_admin",
      performedBy: req.user.id,
      targetUser: customerAuth?._id || null,
      details: {
        updatedFields: Object.keys(updateFields),
        applicationId: application._id,
      },
    });

    // 4. Notify customer
    await createNotification({
      userId: application.customer,
      userRole: "customer",
      title: "Application Updated",
      message: `Your application (${applicationId}) was updated by our team.`,
      type: "ApplicationUpdate",
      referenceId: application._id,
      referenceType: "Application",
    });

    res.status(200).json({
      success: true,
      message: "Application updated successfully",
      data: application,
    });
  } catch (error) {
    console.error("Error updating application:", error);
    res.status(500).json({
      success: false,
      message: "Error updating application",
      error: error.message,
    });
  }
};

//////////////////////////////////////////////Update Steps of workflow//////////////////////////////////////////////////////

// API to approve the onboarding details provided by customer
export const reviewApplicationAfterOnboarding = async (req, res) => {
  const { applicationId } = req.params;
  const { decision, note } = req.body; // decision = "approve" or "clarify"

  try {
    // Validate input
    if (!["approve", "clarify"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision type" });
    }

    // 1. Fetch application
    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // 2. Determine and set new status
    application.status =
      decision === "approve"
        ? "Ready for Processing"
        : "Awaiting Client Response";

    // 3. Store shared note if applicable
    if (decision === "clarify") {
      application.sharedNote = note || "Agent requested clarification.";
    }

    await application.save();

    // 4. Log action
    await logAction({
      type: "application",
      action: "application_reviewed",
      performedBy: req.user.id,
      targetUser: application.customer,
      details: {
        applicationId,
        newStatus: application.status,
        note: decision === "clarify" ? note : undefined,
      },
    });

    // 5. Notify customer
    await createNotification({
      userId: application.customer,
      userRole: "customer",
      title:
        decision === "approve"
          ? "Application Approved"
          : "Clarification Requested",
      message:
        decision === "approve"
          ? `Your application (${application.applicationId}) has been approved.`
          : `Your application (${application.applicationId}) requires clarification.`,
      type: "ApplicationUpdate",
      referenceId: application._id,
      referenceType: "Application",
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

// PATCH: Update Step Status by applicationId
export const updateStepStatus = async (req, res) => {
  const { applicationId } = req.params;
  const { stepName, status } = req.body;

  try {
    if (!stepName || !status) {
      return res
        .status(400)
        .json({ message: "stepName and status are required" });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const stepIndex = application.steps.findIndex(
      (step) => step.stepName === stepName
    );

    if (stepIndex === -1) {
      return res
        .status(400)
        .json({ message: `Step '${stepName}' not found in application.` });
    }

    // ✅ Update the step status
    application.steps[stepIndex].status = status;
    application.steps[stepIndex].updatedAt = new Date();

    // ✅ Recalculate overall application status
    application.status = calculateApplicationStatus(application.steps);

    await application.save();

    const customerAuth = await Auth.findOne({
      userId: application.customer,
      role: "customer",
    }).select("_id");

    // 🧾 Log the update
    await logAction({
      type: "application",
      action: "step_status_updated",
      performedBy: req.user.id,
      targetUser: customerAuth?._id || null,
      details: {
        applicationId,
        stepName,
        newStatus: status,
        updatedApplicationStatus: application.status,
      },
    });

    if (application.status == "Completed") {
      await createNotification({
        userId: application.customer,
        userRole: "customer",
        title: `Application Completed`,
        message: `Your company setup is complete. Documents are in dashboard.`,
        type: "ApplicationUpdate",
        referenceId: application._id,
        referenceType: "Application",
      });
    } else {
      await createNotification({
        userId: application.customer,
        userRole: "customer",
        title: `Step Status Updated: ${stepName}`,
        message: `The ${stepName} step in your application is now ${status}.`,
        type: "ApplicationUpdate",
        referenceId: application._id,
        referenceType: "Application",
      });
    }

    res.status(200).json({
      success: true,
      message: `Step "${stepName}" updated successfully`,
      application,
    });
  } catch (err) {
    console.error("Error updating step:", err);
    res.status(500).json({
      success: false,
      message: "Error updating step",
      error: err.message,
    });
  }
};

export const lockOrUnlockApplication = async (req, res) => {
  const { applicationId } = req.params;
  const { lock } = req.body; // Boolean: true = lock, false = unlock

  try {
    if (typeof lock !== "boolean") {
      return res.status(400).json({ message: "`lock` must be true or false" });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Update lock status
    application.isLocked = lock;
    await application.save();

    await logAction({
      type: "application",
      action: lock ? "application_locked" : "application_unlocked",
      performedBy: req.user.id,
      targetUser: application.customer,
      details: {
        applicationId: application._id,
        newLockStatus: lock,
      },
    });

    res.status(200).json({
      success: true,
      message: `Application has been ${lock ? "locked" : "unlocked"}`,
      isLocked: application.isLocked,
    });
  } catch (err) {
    console.error("Error locking/unlocking application:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update lock status",
      error: err.message,
    });
  }
};

//////////////////////////////////////////Add application notes/////////////////////////////////////////////////////////

export const addNote = async (req, res) => {
  const { applicationId } = req.params;
  const { message } = req.body;
  const user = req.user;

  try {
    const application = await Application.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    application.notes.push({
      message,
      addedBy: user?.userId,
      addedByRole: user?.role,
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

////////////////////////////////////////////Get request API's////////////////////////////////////////////////////////

export const getApplicationById = async (req, res) => {
  const { appId } = req.params;

  const user = req.user;

  console.log("Fetching application for user:", user);

  try {
    const application = await Application.findOne({
      applicationId: appId,
    }).populate("customer");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Manually populate assignedAgent based on assignedAgentRole
    if (application.assignedAgent && application.assignedAgentRole) {
      try {
        if (application.assignedAgentRole === "agent") {
          const agent = await Agent.findById(application.assignedAgent).select(
            "fullName email"
          );
          application.assignedAgent = agent;
        } else if (application.assignedAgentRole === "admin") {
          const admin = await Admin.findById(application.assignedAgent).select(
            "fullName email"
          );
          application.assignedAgent = admin;
        }
      } catch (error) {
        console.error("Error populating assignedAgent:", error);
        application.assignedAgent = null;
      }
    }

    // Manually populate notes.addedBy based on addedByRole
    if (application.notes && application.notes.length > 0) {
      for (let note of application.notes) {
        if (note.addedBy && note.addedByRole) {
          try {
            if (note.addedByRole === "agent") {
              const agent = await Agent.findById(note.addedBy).select(
                "fullName email"
              );
              note.addedBy = agent;
            } else if (note.addedByRole === "admin") {
              const admin = await Admin.findById(note.addedBy).select(
                "fullName email"
              );
              note.addedBy = admin;
            }
          } catch (error) {
            console.error("Error populating note.addedBy:", error);
            note.addedBy = null;
          }
        }
      }
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
  console.log("Fetching application for customerId:", customerId);

  try {
    const application = await Application.findOne({
      customer: customerId,
    }).populate("customer");

    console.log("Application found:", application ? "Yes" : "No");

    if (!application) {
      return res.status(200).json({ message: "Application not created yet" });
    }

    // Manually populate assignedAgent based on assignedAgentRole
    if (application.assignedAgent && application.assignedAgentRole) {
      try {
        if (application.assignedAgentRole === "agent") {
          const agent = await Agent.findById(application.assignedAgent).select(
            "fullName email"
          );
          application.assignedAgent = agent;
        } else if (application.assignedAgentRole === "admin") {
          const admin = await Admin.findById(application.assignedAgent).select(
            "fullName email"
          );
          application.assignedAgent = admin;
        }
      } catch (error) {
        console.error("Error populating assignedAgent:", error);
        application.assignedAgent = null;
      }
    }

    // Manually populate notes.addedBy based on addedByRole
    if (application.notes && application.notes.length > 0) {
      for (let note of application.notes) {
        if (note.addedBy && note.addedByRole) {
          try {
            if (note.addedByRole === "agent") {
              const agent = await Agent.findById(note.addedBy).select(
                "fullName email"
              );
              note.addedBy = agent;
            } else if (note.addedByRole === "admin") {
              const admin = await Admin.findById(note.addedBy).select(
                "fullName email"
              );
              note.addedBy = admin;
            }
          } catch (error) {
            console.error("Error populating note.addedBy:", error);
            note.addedBy = null;
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      data: application,
    });
  } catch (err) {
    console.error("Error in getApplicationByCustomerId:", err);
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
    // If user is admin or manager, show all applications
    // (role === "admin" or role === "manager" or any other role will show all)

    const applications = await Application.find(query)
      .populate("customer", "firstName lastName email phoneNumber")
      .sort({ createdAt: -1 });

    // Manually populate assignedAgent based on assignedAgentRole
    const populatedApplications = await Promise.all(
      applications.map(async (app) => {
        const appObj = app.toObject();

        if (app.assignedAgent && app.assignedAgentRole) {
          try {
            if (app.assignedAgentRole === "agent") {
              const agent = await Agent.findById(app.assignedAgent).select(
                "fullName email"
              );
              appObj.assignedAgent = agent;
            } else if (app.assignedAgentRole === "admin") {
              const admin = await Admin.findById(app.assignedAgent).select(
                "fullName email"
              );
              appObj.assignedAgent = admin;
            }
          } catch (error) {
            console.error("Error populating assignedAgent:", error);
            appObj.assignedAgent = null;
          }
        }

        return appObj;
      })
    );

    res.status(200).json({
      success: true,
      data: populatedApplications,
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
