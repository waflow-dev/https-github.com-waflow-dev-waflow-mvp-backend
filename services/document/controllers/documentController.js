import Document from "../models/documentVaultModel.js";
import Application from "../../application/models/applicationModel.js";
import Customer from "../../user/models/customerModel.js";
import Admin from "../../user/models/adminModel.js";
import Agent from "../../user/models/agentModel.js";
import Auth from "../../auth/models/authModel.js";
import { logAction } from "../../audit logs/utils/logHelper.js";
import workflowConfig from "../../application/utils/workflowConfig.js";
import axios from "axios";
import mongoose from "mongoose";
import { getFileSize } from "../../../utils/cloudinary.js";

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

export const createDocument = async (req, res) => {
  const user = req.user;

  try {
    const {
      documentName,
      documentType,
      relatedStepName,
      linkedTo,
      linkedModel,
      fileUrl,
      expiryDate,
      notes,
    } = req.body;

    // Validate step name only for application-linked documents
    if (linkedModel === "Application" && relatedStepName) {
      const allSteps = [...new Set(Object.values(workflowConfig).flat())];
      if (!allSteps.includes(relatedStepName)) {
        return res.status(400).json({ message: "Invalid relatedStepName" });
      }
    }

    let fullName;
    if (user.role == "customer") {
      fullName = user.firstName;
    } else {
      fullName = user.fullName;
    }

    const newDoc = await Document.create({
      documentName,
      documentType,
      ...(relatedStepName && { relatedStepName }),
      linkedTo,
      linkedModel,
      fileUrl,
      uploadedBy: user.id,
      uploadedByRole: user.role,
      uploadedByFullName: fullName,
      expiryDate,
      notes: {
        message: notes,
        addedBy: user.id,
        addedByRole: user.role,
        addedByFullName: fullName,
      },
    });

    let applicationId;
    if (linkedModel == "Application") applicationId = linkedTo;

    await logAction({
      type: "document",
      action: "document_uploaded",
      performedBy: req.user.id,
      targetUser: linkedModel === "Customer" ? linkedTo : null,
      details: {
        documentId: newDoc._id,
        linkedTo,
        linkedModel,
        documentType,
        relatedStepName,
      },
    });

    // --- NEW LOGIC: If this is the first document for the application, update Application status ---
    if (linkedModel === "Application" && applicationId) {
      const docCount = await Document.countDocuments({
        linkedModel: "Application",
        linkedTo: applicationId,
      });
      if (docCount === 1) {
        const application = await Application.findById(applicationId);
        if (application && application.status === "New") {
          application.status = "Waiting for Agent Review";
          await application.save();
        }
      }
    }
    // --- END NEW LOGIC ---

    if (applicationId && relatedStepName) {
      const application = await Application.findById(applicationId);
      if (application) {
        const step = application.steps.find(
          (s) => s.stepName === relatedStepName
        );
        if (step && step.status === "Not Started") {
          step.status = "Submitted for Review";
          step.updatedAt = new Date();
          application.status = calculateApplicationStatus(application.steps);
          await application.save();
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Document saved successfully",
      data: newDoc,
    });
  } catch (err) {
    console.error("Error uploading document:", err);
    res.status(500).json({
      success: false,
      message: "Error saving document",
      error: err.message,
    });
  }
};

export const updateDocumentStatus = async (req, res) => {
  const { id } = req.params;
  const { status, notes, expiryDate } = req.body;

  try {
    const validStatuses = ["Pending", "Approved", "Rejected"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const updatedDoc = await Document.findByIdAndUpdate(
      id,
      {
        ...(status && { status }),
        ...(notes && { notes }),
        ...(expiryDate && { expiryDate }),
      },
      { new: true }
    );

    if (!updatedDoc) {
      return res.status(404).json({ message: "Document not found" });
    }

    await logAction({
      type: "document",
      action: `document_status_updated_to_${status.toLowerCase()}`,
      performedBy: req.user.id,
      targetUser: updatedDoc.userId,
      details: {
        documentId: updatedDoc._id,
        newStatus: status,
        notes,
        expiryDate,
      },
    });

    // 👇 Manually reject step if a document is rejected
    if (status === "Rejected" && updatedDoc.relatedStepName) {
      const appId =
        updatedDoc.linkedModel === "Application"
          ? updatedDoc.linkedTo
          : (await Application.findOne({ customer: updatedDoc.linkedTo }))?._id;

      if (appId) {
        const application = await Application.findById(appId);
        const step = application?.steps.find(
          (s) => s.stepName === updatedDoc.relatedStepName
        );

        if (step && step.status !== "Approved") {
          step.status = "Rejected";
          step.updatedAt = new Date();
          application.status = calculateApplicationStatus(application.steps);
          await application.save();
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Document updated successfully",
      data: updatedDoc,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error updating document",
      error: err.message,
    });
  }
};

// Retain: getCustomerDocuments
export const getCustomerDocuments = async (req, res) => {
  const { customerId } = req.params;
  const { status, documentType } = req.query;

  // Validate customerId is a valid ObjectId and not the string 'status'
  if (customerId === "status" || !mongoose.Types.ObjectId.isValid(customerId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid customerId",
    });
  }

  try {
    const filter = {
      linkedTo: customerId,
      linkedModel: "Customer",
    };

    if (status) filter.status = status;
    if (documentType) filter.documentType = documentType;

    const docs = await Document.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: docs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching customer documents",
      error: err.message,
    });
  }
};

// Updated: getApplicationDocuments
export const getApplicationDocuments = async (req, res) => {
  const { appId } = req.params;
  const { status, linkedModel } = req.query;

  try {
    // First get the application to know its linked customer
    const application = await Application.findOne({
      _id: appId,
    }).select("customer");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const filterApp = {
      linkedTo: appId,
      linkedModel: "Application",
    };

    const filterCustomer = {
      linkedTo: application.customer,
      linkedModel: "Customer",
    };

    if (status) {
      filterApp.status = status;
      filterCustomer.status = status;
    }

    if (linkedModel) {
      filterApp.linkedModel = linkedModel;
      filterCustomer.linkedModel = linkedModel;
    }

    // 🔹 Fetch both application and customer docs
    const [applicationDoc, customerDoc] = await Promise.all([
      Document.find(filterApp).sort({ createdAt: -1 }),
      Document.find(filterCustomer).sort({ createdAt: -1 }),
    ]);

    // 🔹 Add fileSize to each doc
    const addSizes = async (docs) =>
      Promise.all(
        docs.map(async (doc) => {
          try {
            const fileInfo = await getFileSize(doc.fileUrl); // assume fileInfo.bytes exists
            const bytes = fileInfo.bytes || 0;

            let fileSize;
            if (bytes < 1024 * 1024) {
              const kb = Math.round(bytes / 1024); // round off
              fileSize = `${kb} KB`;
            } else {
              const mb = Number((bytes / (1024 * 1024)).toFixed(2)); // 2 decimals
              fileSize = `${mb} MB`;
            }

            return { ...doc.toObject(), fileSize };
          } catch (err) {
            return { ...doc.toObject(), fileSize: "Size unavailable" };
          }
        })
      );

    const [applicationDocs, customerDocs] = await Promise.all([
      addSizes(applicationDoc),
      addSizes(customerDoc),
    ]);

    // 🔹 Compute total size of application docs in bytes
    const totalBytes = applicationDocs.reduce((acc, d) => {
      const match = d.fileSize.match(/([\d.]+)\s*(KB|MB)/);
      if (!match) return acc;

      const value = parseFloat(match[1]);
      const unit = match[2];

      return acc + (unit === "KB" ? value * 1024 : value * 1024 * 1024);
    }, 0);

    // 🔹 Convert totalBytes into KB or MB
    let totalDocumentSize;
    if (totalBytes === 0) {
      totalDocumentSize = "0 KB";
    } else if (totalBytes < 1024 * 1024) {
      const kb = Math.round(totalBytes / 1024);
      totalDocumentSize = `${kb} KB`;
    } else {
      const mb = Number((totalBytes / (1024 * 1024)).toFixed(2));
      totalDocumentSize = `${mb} MB`;
    }

    res.status(200).json({
      success: true,
      applicationDocs,
      customerDocs,
      counts: {
        applicationDocsCount: applicationDocs.length,
        customerDocsCount: customerDocs.length,
        totalDocsCount: applicationDocs.length + customerDocs.length,
      },
      totalDocumentSize,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching application & customer documents",
      error: err.message,
    });
  }
};

// ✅ Retain: serveDocumentFile
export const serveDocumentFile = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).send("File not found");

    const fileUrl = doc.fileUrl;
    if (!fileUrl) return res.status(404).send("File URL not found");

    const fileType = fileUrl.split(".").pop().toLowerCase();

    const response = await axios.get(fileUrl, { responseType: "stream" });

    res.setHeader(
      "Access-Control-Allow-Origin",
      "https://waflow-frontend.vercel.app"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (fileType === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
    }
    response.data.pipe(res);
  } catch (err) {
    console.error("Error serving file:", err);
    res.status(500).send("Error serving file: " + (err?.message || err));
  }
};

export const addDocumentNote = async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  const addedBy = req.user.id;
  const addedByRole = req.user.role;
  const addedByFullName = req.user.fullName;

  try {
    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (!doc.notes) doc.notes = [];
    doc.notes.push({
      message,
      addedBy,
      addedByRole,
      addedByFullName,
      timestamp: new Date(),
    });
    await doc.save();

    await logAction({
      type: "document",
      action: "note_added_to_document",
      performedBy: addedBy,
      targetUser: doc.userId,
      details: {
        documentId: doc._id,
        note: message,
        addedByRole,
      },
    });

    res.status(200).json({ success: true, notes: doc.notes });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to add note",
      error: err.message,
    });
  }
};
