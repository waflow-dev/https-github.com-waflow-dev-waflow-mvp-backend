import Document from "../models/documentVaultModel.js";
import { logAction } from "../../audit logs/utils/logHelper.js";
import { autoApproveStepsIfDocsValid } from "../../application/controllers/applicationController.js";

export const createDocument = async (req, res) => {
  try {
    const {
      documentName,
      documentType,
      linkedTo,
      linkedModel,
      fileUrl,
      uploadedBy,
      expiryDate,
      notes,
    } = req.body;

    const newDoc = await Document.create({
      documentName,
      documentType,
      linkedTo,
      linkedModel,
      fileUrl,
      uploadedBy,
      expiryDate,
      notes,
    });

    res.status(201).json({
      success: true,
      message: "Document saved successfully",
      data: newDoc,
    });
  } catch (err) {
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
