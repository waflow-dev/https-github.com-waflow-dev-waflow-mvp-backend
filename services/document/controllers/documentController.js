import Document from "../models/documentVaultModel.js";
import Application from "../../application/models/applicationModel.js";
import { logAction } from "../../audit logs/utils/logHelper.js";
import { autoApproveStepsIfDocsValid } from "../../application/controllers/applicationController.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import axios from "axios";

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

export const createDocument = async (req, res) => {
  const user = req.user;

  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: "File is required (image or PDF)" });
  }

  try {
    // Upload the file to Cloudinary
    const cloudinaryResult = await uploadOnCloudinary(file.path);

    if (!cloudinaryResult?.secure_url && !cloudinaryResult?.url) {
      return res.status(500).json({ message: "File upload failed" });
    }

    const uploadedFileUrl = cloudinaryResult.secure_url || cloudinaryResult.url;

    // Extract other fields from body
    const {
      documentName,
      documentType,
      linkedTo,
      linkedModel,
      expiryDate,
      notes,
      applicationId,
      relatedStepName,
    } = req.body;

    // Save document to database
    const newDoc = await Document.create({
      documentName,
      documentType,
      linkedTo: user?.userId,
      linkedModel,
      fileUrl: uploadedFileUrl,
      userId: user?.userId,
      expiryDate,
      notes,
    });

    // --- NEW LOGIC: If this is the first document for the application, update Application status ---
    if (linkedModel === 'Application' && applicationId) {
      const docCount = await Document.countDocuments({
        linkedModel: 'Application',
        linkedTo: applicationId
      });
      if (docCount === 1) {
        const app = await Application.findById(applicationId);
        if (app && app.status === 'New') {
          app.status = 'Submitted for Review';
          await app.save();
        }
      }
    }
    // --- END NEW LOGIC ---

    if (applicationId && relatedStepName) {
      const application = await Application.findById(applicationId);
      if (application) {
        const step = application.steps.find(
          (s) => s.stepName.toLowerCase() === relatedStepName.toLowerCase()
        );

        if (step && step.status === "Not Started") {
          step.status = "Submitted for Review";
          step.updatedAt = new Date();
          application.status = calculateApplicationStatus(application.steps); // Recalculate overall status
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

    await autoApproveStepsIfDocsValid(updatedDoc.linkedTo);

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

export const getCustomerDocuments = async (req, res) => {
  const { customerId } = req.params;
  const { status, documentType } = req.query;

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

export const getApplicationDocuments = async (req, res) => {
  const { appId } = req.params;
  const { status, documentType } = req.query;

  try {
    const filter = {
      linkedTo: appId,
      linkedModel: "Application",
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
      message: "Error fetching application documents",
      error: err.message,
    });
  }
};

export const serveDocumentFile = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).send("File not found");

    const fileUrl = doc.fileUrl;
    if (!fileUrl) return res.status(404).send("File URL not found");

    const fileType = fileUrl.split(".").pop().toLowerCase();

    // Fetch the file as a stream
    const response = await axios.get(fileUrl, { responseType: "stream" });

    // Set CORS and content headers
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

  try {
    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (!doc.notes) doc.notes = [];
    doc.notes.push({ message, addedBy, addedByRole, timestamp: new Date() });
    await doc.save();

    res.status(200).json({ success: true, notes: doc.notes });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to add note", error: err.message });
  }
};
