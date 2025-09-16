import Application from "../models/applicationModel.js";
import Customer from "../../user/models/customerModel.js";
import Agent from "../../user/models/agentModel.js";
import Admin from "../../user/models/adminModel.js";
import Auth from "../../auth/models/authModel.js";
import { logAction } from "../../audit logs/utils/logHelper.js";
import { createNotification } from "../../notification/controllers/notificationController.js";
import workflowConfig from "../utils/workflowConfig.js";
import Document from "../../document/models/documentVaultModel.js";
import sendEmail from "../../notification/utils/sendEmail.js";
import jwt from "jsonwebtoken";
import { application } from "express";

////////////////////////////////////////Helper Function////////////////////////////////////////////////////////////////

//  Helper to determine app status
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
    applicationType,
    emirate,
    legalForm,
    proposedCompanyNamesEN,
    proposedCompanyNameAR,
    jurisdiction,
    officeRequired,
    officeType,
    additionalNotes,
    totalAgreedCost,
    paymentEntries = [],
  } = req.body;

  try {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

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

    // Decide assignedAgent depending on role
    let finalAssignedAgent;
    if (req.user.role === "admin") {
      finalAssignedAgent = assignedAgent || req.user.id; // Admin creating → use provided or fallback to self
    } else if (req.user.role === "agent") {
      finalAssignedAgent = req.user.id; // Agent creating → auto-assign themselves
    } else {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to create applications",
      });
    }

    const notesArray = [];
    if (additionalNotes && additionalNotes.trim() !== "") {
      notesArray.push({
        message: additionalNotes,
        addedByFullName: req.user.fullName,
        addedBy: req.user.id,
        addedByRole: req.user.role,
      });
    }

    const newApplication = await Application.create({
      applicationId,
      customer: customerId,
      assignedAgent: finalAssignedAgent,
      applicationType,
      emirate,
      legalForm,
      proposedCompanyNamesEN,
      proposedCompanyNameAR,
      jurisdiction,
      officeRequired,
      officeType,
      notes: notesArray,
      totalAgreedCost,
      paymentEntries: paymentEntries.filter((entry) =>
        Object.values(entry).some(
          (val) => val !== null && val !== "" && val !== undefined
        )
      ),
      steps,
    });

    // Create DocumentVault entries for receipt uploads
    const receiptDocs = paymentEntries
      .filter((entry) => entry.receiptUpload) // only those with receipts
      .map((entry) => ({
        documentName: "Payment Receipt", // dummy
        documentType: "Receipt", // dummy
        linkedTo: newApplication._id,
        linkedModel: "Application",
        fileUrl: entry.receiptUpload, // actual uploaded receipt
        uploadedBy: req.user.id,
        uploadedByRole: req.user.role,
        uploadedByFullName: req.user.fullName,
      }));

    if (receiptDocs.length > 0) {
      await Document.insertMany(receiptDocs);
    }

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
    const application = await Application.findOne({
      applicationId: applicationId,
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    //  Prevent update if locked
    if (application.isLocked) {
      return res.status(403).json({
        message: "Application is locked and cannot be edited by the customer",
      });
    }

    //  Update only the customer-editable fields
    if (businessActivities) application.businessActivities = businessActivities;
    if (numberOfShareholders !== undefined)
      application.numberOfShareholders = numberOfShareholders;
    if (basicInvestment !== undefined)
      application.basicInvestment = basicInvestment;
    if (sponsorRequired !== undefined)
      application.sponsorRequired = sponsorRequired;
    if (Array.isArray(sponsorDetails))
      application.sponsorDetails = sponsorDetails;
    if (Array.isArray(shareholderDetails))
      application.shareholderDetails = shareholderDetails;

    //  Update status & save
    // application.status = "Ready for Processing";
    await application.save();

    // Collect file uploads to save in DocumentVault
    const filesToSave = [];

    // Sponsor details uploads
    // Sponsor details uploads (loop through each sponsor)
    if (Array.isArray(sponsorDetails)) {
      sponsorDetails.forEach((sponsor, index) => {
        if (sponsor.passportCopy) {
          filesToSave.push({
            documentName: `Sponsor ${index + 1} Passport Copy`,
            documentType: "Sponser Passport",
            linkedTo: application._id,
            linkedModel: "Application",
            fileUrl: sponsor.passportCopy,
            uploadedBy: req.user.id,
            uploadedByRole: req.user.role,
            uploadedByFullName: req.user.firstName || "Customer",
          });
        }
        if (sponsor.emiratesId) {
          filesToSave.push({
            documentName: `Sponsor ${index + 1} Emirates ID`,
            documentType: "Sponser Emirates",
            linkedTo: application._id,
            linkedModel: "Application",
            fileUrl: sponsor.emiratesId,
            uploadedBy: req.user.id,
            uploadedByRole: req.user.role,
            uploadedByFullName: req.user.firstName || "Customer",
          });
        }
      });
    }

    // Shareholder details uploads
    if (Array.isArray(shareholderDetails)) {
      shareholderDetails.forEach((shareholder, index) => {
        if (shareholder.passportCopy) {
          filesToSave.push({
            documentName: `Shareholder ${index + 1} Passport Copy`,
            documentType: "Shareholder Passport",
            linkedTo: application._id,
            linkedModel: "Application",
            fileUrl: shareholder.passportCopy,
            uploadedBy: req.user.id,
            uploadedByRole: req.user.role,
            uploadedByFullName: req.user.firstName || "Customer",
          });
        }
        if (shareholder.emiratesId) {
          filesToSave.push({
            documentName: `Shareholder ${index + 1} Emirates ID`,
            documentType: "Shareholder Emirates",
            linkedTo: application._id,
            linkedModel: "Application",
            fileUrl: shareholder.emiratesId,
            uploadedBy: req.user.id,
            uploadedByRole: req.user.role,
            uploadedByFullName: req.user.firstName || "Customer",
          });
        }
        if (shareholder.passportPhoto) {
          filesToSave.push({
            documentName: `Shareholder ${index + 1} Passport Photo`,
            documentType: "Shareholder Photo",
            linkedTo: application._id,
            linkedModel: "Application",
            fileUrl: shareholder.passportPhoto,
            uploadedBy: req.user.id,
            uploadedByRole: req.user.role,
            uploadedByFullName: req.user.firstName || "Customer",
          });
        }
        if (shareholder.nocLetter) {
          filesToSave.push({
            documentName: `Shareholder ${index + 1} NOC Letter`,
            documentType: "Shareholder NOC",
            linkedTo: application._id,
            linkedModel: "Application",
            fileUrl: shareholder.nocLetter,
            uploadedBy: req.user.id,
            uploadedByRole: req.user.role,
            uploadedByFullName: req.user.firstName || "Customer",
          });
        }
      });
    }

    // Bulk insert into DocumentVault
    if (filesToSave.length > 0) {
      await Document.insertMany(filesToSave);
    }

    res.status(200).json({
      success: true,
      message: "Application onboarding details saved successfully.",
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

// POST /api/applications/finalOnboarding
export const finalOnboarding = async (req, res) => {
  const { applicationId } = req.body;

  try {
    const application = await Application.findOne({
      applicationId: applicationId,
    });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Update application status
    application.status = "Ready for Processing";
    await application.save();

    // Fetch customer + agent auth
    const customerAuth = await Auth.findOne({
      userId: application.customer,
      role: "customer",
    });

    const agentAuth = await Auth.findOne({
      userId: application.assignedAgent,
      role: "agent",
    });

    // Send email notification to agent
    await sendEmail(
      agentAuth.email,
      ` New Application Submitted - ${req.user.firstName}`,
      `Dear Team, 	
       This is to notify you that ${req.user.firstName} has successfully submitted a new application through the Waflow portal. The application is now available in your dashboard.
       We request you to review the submitted details promptly and initiate the processing workflow. Ensuring timely action will help us deliver a seamless and professional experience for the customer.
       For any clarification, you may use the notes section within the portal. Please acknowledge the submission by updating the application status after your initial review.
       Thank you for your continued diligence. Waflow System Notification`
    );

    // Send email notification to customer
    await sendEmail(
      req.user.email,
      `New Application Submitted by ${req.user.firstName}`,
      `Your application has passed review and is now under processing.`
    );

    // Create in-app notification for Customer
    await createNotification({
      userId: application.customer,
      userRole: "customer",
      title: "Onboarding Submitted",
      message: `${req.user.firstName} has submitted their onboarding form.`,
      type: "application",
      referenceId: application._id,
      referenceType: "Application",
    });

    // Create in-app notification for Agent
    await createNotification({
      userId: application.assignedAgent,
      userRole: "agent",
      title: "Onboarding Submitted",
      message: `${req.user.firstName} has submitted their onboarding form.`,
      type: "application",
      referenceId: application._id,
      referenceType: "Application",
    });

    // Create in-app notification for Admin
    await createNotification({
      userRole: "admin",
      title: "Onboarding Submitted",
      message: `${req.user.firstName} has submitted their onboarding form.`,
      type: "application",
      referenceId: application._id,
      referenceType: "Application",
    });

    // Log action
    await logAction({
      type: "application",
      action: "onboarding_submitted",
      performedBy: req.user.id,
      targetUser: customerAuth?._id || null,
      details: {
        applicationId: application._id,
      },
    });

    return res.status(200).json({
      message: "Final onboarding completed successfully",
      application,
    });
  } catch (error) {
    console.error("Error in finalOnboarding:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//////////////////////////////////////////////Update Steps of workflow//////////////////////////////////////////////////////

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
      "jurisdiction",
      "officeRequired",
      "officeType",
      "totalAgreedCost",
      "paymentEntries", // Repeatable group
      "status",
      "assignedAgent",
    ];

    //  Payment validation logic
    if (updateFields.paymentEntries) {
      const totalPaid = updateFields.paymentEntries.reduce(
        (sum, entry) => sum + (entry.amountPaid || 0),
        0
      );

      if (
        application.totalAgreedCost !== undefined &&
        totalPaid > application.totalAgreedCost
      ) {
        return res.status(400).json({
          success: false,
          message: `Total paid amount (AED ${totalPaid}) cannot exceed Total Agreed Cost (AED ${application.totalAgreedCost}).`,
        });
      }
    }

    for (let key of allowedFields) {
      if (updateFields[key] !== undefined) {
        application[key] = updateFields[key];
      }
    }

    await application.save();

    const customerAuth = await Auth.findOne({
      userId: application.customer,
      role: "customer",
    });

    // 3. Createe in-app notifications
    await createNotification({
      userId: application.customer,
      userRole: "customer",
      title: "Application Data Updated",
      message: `Your application (${applicationId}) was updated by our team.`,
      type: "Application Update",
      referenceId: application._id,
      referenceType: "Application",
    });

    await createNotification({
      userId: application.assignedAgent,
      userRole: "agent",
      title: "Application Data Updated",
      message: `Your application (${applicationId}) was updated by our team.`,
      type: "Application Update",
      referenceId: application._id,
      referenceType: "Application",
    });

    await createNotification({
      userRole: "admin",
      title: "Application Data Updated",
      message: `Your application (${applicationId}) was updated by our team.`,
      type: "Application Update",
      referenceId: application._id,
      referenceType: "Application",
    });

    // 4. Log action
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

// // API to approve the onboarding details provided by customer
// export const reviewApplicationAfterOnboarding = async (req, res) => {
//   const { applicationId } = req.params;
//   const { decision, note } = req.body; // decision = "approve" or "clarify"

//   try {
//     // Validate input
//     if (!["approve", "clarify"].includes(decision)) {
//       return res.status(400).json({ message: "Invalid decision type" });
//     }

//     // 1. Fetch application
//     const application = await Application.findOne({
//       applicationId: applicationId,
//     });
//     if (!application) {
//       return res.status(404).json({ message: "Application not found" });
//     }

//     // 2. Determine and set new status
//     application.status =
//       decision === "approve"
//         ? "Ready for Processing"
//         : "Awaiting Client Response";

//     // 3. Store shared note if applicable
//     if (decision === "clarify") {
//       application.sharedNote = note || "Agent requested clarification.";
//     }

//     await application.save();

//     // 4. Log action
//     await logAction({
//       type: "application",
//       action: "application_reviewed",
//       performedBy: req.user.id,
//       targetUser: application.customer,
//       details: {
//         applicationId,
//         newStatus: application.status,
//         note: decision === "clarify" ? note : undefined,
//       },
//     });

//     // 5. Notify customer
//     await createNotification({
//       userId: application.customer,
//       userRole: "customer",
//       title:
//         decision === "approve"
//           ? "Application Approved"
//           : "Clarification Requested",
//       message:
//         decision === "approve"
//           ? `Your application (${application.applicationId}) has been approved.`
//           : `Your application (${application.applicationId}) requires clarification.`,
//       type: "ApplicationUpdate",
//       referenceId: application._id,
//       referenceType: "Application",
//     });

//     res.status(200).json({
//       success: true,
//       message:
//         decision === "approve"
//           ? "Application marked as Ready for Processing"
//           : "Clarification requested from customer",
//       applicationStatus: application.status,
//     });
//   } catch (err) {
//     console.error("Review error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Error reviewing application",
//       error: err.message,
//     });
//   }
// };

// PATCH: Update Step Status by applicationId
export const updateStepStatus = async (req, res) => {
  const { applicationId } = req.params;
  const { stepName, status } = req.body;
  const user = req.user;

  console.log("🔍 updateStepStatus called with:", {
    applicationId,
    stepName,
    status,
    body: req.body,
    params: req.params,
  });

  try {
    const application = await Application.findOne({
      _id: applicationId,
    });

    console.log("🔍 Application search result:", {
      found: !!application,
      applicationId: application?.applicationId,
      stepsCount: application?.steps?.length,
      steps: application?.steps?.map((s) => ({
        stepName: s.stepName,
        status: s.status,
      })),
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Find the step to update
    const stepToUpdate = application.steps.find(
      (step) => step.stepName === stepName
    );

    console.log("🔍 Step search result:", {
      stepName,
      stepFound: !!stepToUpdate,
      stepDetails: stepToUpdate,
    });

    if (!stepToUpdate) {
      return res.status(404).json({ error: "Step not found" });
    }

    // Update step status
    stepToUpdate.status = status;
    stepToUpdate.updatedAt = new Date();
    stepToUpdate.updatedBy = user.id;
    stepToUpdate.updatedByRole = user.role;
    stepToUpdate.updatedByFullName = user.fullName;

    // Update application status based on step completion
    if (status === "Approved") {
      const allStepsApproved = application.steps.every(
        (step) => step.status === "Approved"
      );
      if (allStepsApproved) {
        application.status = "Completed";
        application.isLocked = true;
      }
    }

    await application.save();

    const customerAuth = await Auth.findOne({
      userId: application.customer,
      role: "customer",
    });

    if (status === "Approved" || status === "Rejected") {
      await sendEmail(
        customerAuth.email,
        `Update on Your Application Step: ${stepName}`,
        `The status of “${stepName}” has been updated to ${status}.`
      );

      // Create in-app notification for Customer
      await createNotification({
        userId: application.customer,
        userRole: "customer",
        title: `Step Status Updated: ${stepName}`,
        message: `The “${stepName}” step in your application is now ${status}.`,
        type: "application",
        referenceId: application._id,
        referenceType: "Application",
      });

      // Create in-app notification for Agent
      await createNotification({
        userId: application.assignedAgent,
        userRole: "agent",
        title: `Step Status Updated: ${stepName}`,
        message: `The “${stepName}” step in your application is now ${status}.`,
        type: "application",
        referenceId: application._id,
        referenceType: "Application",
      });

      // Create in-app notification for Admin
      await createNotification({
        userRole: "admin",
        title: `Step Status Updated: ${stepName}`,
        message: `The “${stepName}” step in your application is now ${status}.`,
        type: "application",
        referenceId: application._id,
        referenceType: "Application",
      });
    }

    // If Application is completed
    if (application.status == "Completed") {
      // Send email to customer
      await sendEmail(
        customerAuth.email,
        `Congratulations - Your Company Setup is Complete`,
        `Your application is complete. Relevant documents are available in the portal.`
      );

      // Create in-app notification for Customer
      await createNotification({
        userId: application.customer,
        userRole: "customer",
        title: `Application Completed`,
        message: `Your company setup is complete. Documents are in dashboard.`,
        type: "application",
        referenceId: application._id,
        referenceType: "Application",
      });

      // Create in-app notification for Agent
      await createNotification({
        userId: application.assignedAgent,
        userRole: "agent",
        title: `Application Completed`,
        message: `Your company setup is complete. Documents are in dashboard.`,
        type: "application",
        referenceId: application._id,
        referenceType: "Application",
      });

      // Create in-app notification for Admin
      await createNotification({
        userRole: "admin",
        title: `Application Completed`,
        message: `Your company setup is complete. Documents are in dashboard.`,
        type: "application",
        referenceId: application._id,
        referenceType: "Application",
      });
    }

    // Log the action
    await logAction({
      type: "application",
      action: "step_status_updated",
      performedBy: req.user.id,
      targetUser: application.customer,
      details: {
        applicationId,
        stepName,
        newStatus: status,
        updatedApplicationStatus: application.status,
      },
    });

    res.json({
      message: "Step status updated successfully",
      step: stepToUpdate,
      applicationStatus: application.status,
    });
  } catch (error) {
    console.error("Error updating step status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const lockOrUnlockApplication = async (req, res) => {
  const { applicationId } = req.params;
  const { lock } = req.body; // Boolean: true = lock, false = unlock

  try {
    if (typeof lock !== "boolean") {
      return res.status(400).json({ message: "`lock` must be true or false" });
    }

    const application = await Application.findOne({
      applicationId: applicationId,
    });
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

  console.log(user.id, user.role);
  try {
    const application = await Application.findOne({ _id: applicationId })
      .populate("customer")
      .populate("assignedAgent");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    application.notes.push({
      message,
      addedBy: user.id,
      addedByRole: user.role,
      addedByFullName: user.fullName,
      timestamp: new Date(),
    });

    await application.save();

    // Send emails
    if (user.role == "customer") {
      await sendEmail(
        application.assignedAgent.email,
        `${user.firstName} Left a Note on Their Application`,
        `${user.firstName} has added a comment to their application. Log in to respond.`
      );
    } else if (user.role == "agent" || user.role == "admin") {
      await sendEmail(
        application.customer.email,
        `Your Agent Left a Note on Your Application`,
        `Your agent or manager added a note on your application. Please log in to review it.`
      );
    }

    // Create in-app notifications
    if (user.role == "customer") {
      // Create in-app notification for Customer
      await createNotification({
        userId: application.customer,
        userRole: "customer",
        title: `Customer Note Received`,
        message: `${user.fullName} has left a note on their application.`,
        type: "application",
        referenceId: application._id,
        referenceType: "Application",
      });

      // Create in-app notification for Agent
      await createNotification({
        userId: application.assignedAgent,
        userRole: "agent",
        title: `Customer Note Received`,
        message: `${user.fullName} has left a note on their application.`,
        type: "application",
        referenceId: application._id,
        referenceType: "Application",
      });

      // Create in-app notification for Admin
      await createNotification({
        userRole: "admin",
        title: `Customer Note Received`,
        message: `${user.fullName} has left a note on their application.`,
        type: "application",
        referenceId: application._id,
        referenceType: "Application",
      });
    } else if (user.role == "agent" || user.role == "admin") {
      // Create in-app notification for Customer
      await createNotification({
        userId: application.customer,
        userRole: "customer",
        title: `Agent Note Sent to Customer`,
        message: `Your agent has left a note on your application.`,
        type: "application",
        referenceId: application._id,
        referenceType: "Application",
      });

      // Create in-app notification for Agent
      await createNotification({
        userId: application.assignedAgent,
        userRole: "agent",
        title: `Agent Note Sent to Customer`,
        message: `Your agent has left a note on your application.`,
        type: "application",
        referenceId: application._id,
        referenceType: "Application",
      });

      // Create in-app notification for Admin
      await createNotification({
        userRole: "admin",
        title: `Agent Note Sent to Customer`,
        message: `Your agent has left a note on your application.`,
        type: "application",
        referenceId: application._id,
        referenceType: "Application",
      });
    }

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
    })
      .populate("customer")
      .populate("assignedAgent");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
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
            } else if (note.addedByRole === "customer") {
              const customer = await Customer.findById(note.addedBy).select(
                "fullName email"
              );
              note.addedBy = customer;
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

export const getApplicationsByCustomerId = async (req, res) => {
  try {
    const { customerId } = req.params;

    //  Validate customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    //  Find all applications linked to this customer
    let applications = await Application.find({ customer: customerId })
      .populate("customer") // populate customer details
      .populate("assignedAgent"); // populate assigned agent details

    if (!applications || applications.length === 0) {
      return res
        .status(404)
        .json({ message: "No applications found for this customer" });
    }

    // Manually populate notes.addedBy based on addedByRole
    for (let application of applications) {
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
              } else if (note.addedByRole === "customer") {
                const customer = await Customer.findById(note.addedBy).select(
                  "fullName email"
                );
                note.addedBy = customer;
              }
            } catch (error) {
              console.error("Error populating note.addedBy:", error);
              note.addedBy = null;
            }
          }
        }
      }
    }

    // Add portalState for customer portal usage
    applications = applications.map((app) => {
      const appObj = app.toObject();

      if (appObj.status === "New") {
        appObj.portalState = "Initial";
      } else {
        appObj.portalState = "Workflow";
      }
      return appObj;
    });

    //  Send back both customer info & applications
    res.status(200).json({
      customer,
      applications,
      Total: applications.length,
    });
  } catch (error) {
    console.error("Error in getApplicationsByCustomerId:", error);
    res.status(500).json({ message: "Server error", error: error.message });
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

        if (app.assignedAgent) {
          try {
            const agent = await Agent.findById(app.assignedAgent).select(
              "fullName email"
            );
            appObj.assignedAgent = agent;
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

export const showApplicationWithDoucuments = async (req, res) => {
  const { appId } = req.params;

  try {
    const application = await Application.findOne({
      applicationId: appId,
    }).lean();
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const customerId = application.customer;

    const customer = await Customer.findById(customerId).lean();
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Get all documents uploaded by this customer
    const documents = await Document.find({
      linkedTo: application._id,
      linkedModel: "Application",
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
