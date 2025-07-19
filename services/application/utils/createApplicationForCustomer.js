// application/services/createApplicationForCustomer.js
import Application from "../models/applicationModel.js";
import Customer from "../../user/models/customerModel.js";
import workflowConfig from "../utils/workflowConfig.js";
import { logAction } from "../../audit logs/utils/logHelper.js";

export const createApplicationForCustomer = async ({
  customerId,
  assignedAgentId,
  performedBy,
}) => {
  const existing = await Application.findOne({ customer: customerId });
  if (existing) {
    throw new Error("Application already exists for this customer.");
  }

  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error("Customer not found");
  }

  const jurisdiction = customer.jurisdiction?.toLowerCase();
  const stepsFromConfig = workflowConfig[jurisdiction];

  if (!stepsFromConfig) {
    throw new Error("Workflow steps not defined for jurisdiction");
  }

  const steps = stepsFromConfig.map((step) => ({
    stepName: step,
    status: "Not Started",
    updatedAt: new Date(),
  }));

  const application = await Application.create({
    customer: customerId,
    assignedAgent: assignedAgentId || null,
    steps,
    status: "New",
  });

  await logAction({
    type: "application",
    action: "application_created",
    performedBy,
    targetUser: customerId,
    details: { assignedAgent: assignedAgentId },
  });

  return application;
};
