import Customer from "../../user/models/customerModel.js";
import Admin from "../../user/models/adminModel.js";
import Application from "../../application/models/applicationModel.js";
import sendEmail from "../../notification/utils/sendEmail.js";
import Auth from "../../auth/models/authModel.js";
import Agent from "../../user/models/agentModel.js";
import bcrypt from "bcryptjs";
import { logAction } from "../../audit logs/utils/logHelper.js";
import workflowConfig from "../../application/utils/workflowConfig.js";
import { createApplicationForCustomer } from "../../application/utils/createApplicationForCustomer.js";

export const createCustomer = async (req, res) => {
  try {
    const {
      assignedAgentId,
      firstName,
      middleName,
      lastName,
      dob,
      email,
      phoneNumber,
      currentAddress,
      permanentAddress,
      nationality,
      gender,
      designation,
      companyType,
      jurisdiction,
      businessActivity1,
      officeType,
      quotedPrice,
      paymentPlans,
      paymentDetails,
      password,
    } = req.body;

    const existing = await Auth.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Customer already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const customer = await Customer.create({
      assignedAgentId: assignedAgentId || null,
      firstName,
      middleName,
      lastName,
      dob,
      email,
      role: "customer",
      phoneNumber,
      currentAddress,
      permanentAddress,
      nationality,
      gender,
      designation,
      companyType,
      jurisdiction,
      businessActivity1,
      officeType,
      quotedPrice,
      paymentPlans,
      paymentDetails,
    });

    await Auth.create({
      userId: customer._id,
      email,
      passwordHash,
      role: "customer",
    });

    await createApplicationForCustomer({
      customerId: customer._id,
      assignedAgentId: assignedAgentId || req.user.userId,
      performedBy: req.user.id,
    });

    // await sendEmail(
    //   email,
    //   "Account created",
    //   `Your account has been successfully created, please login.`
    // );

    await logAction({
      type: "user",
      action: "customer_created",
      performedBy: req.user.id,
      targetUser: customer._id,
      details: {
        name: `${firstName} ${lastName}`,
        email,
        createdByRole: req.user.role,
      },
    });

    res
      .status(201)
      .json({ message: "Customer created and onboarded successfully" });
  } catch (error) {
    console.error("Error creating customer:", error); // Log full error
    res.status(500).json({
      message: "Error creating customer",
      error: error.message,
      stack: error.stack, // Include stack trace for debugging
    });
  }
};

export const createAgent = async (req, res) => {
  const { fullName, email, phoneNumber, password } = req.body;

  try {
    const exists = await Auth.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const agent = await Agent.create({ fullName, email, phoneNumber });
    await Auth.create({
      userId: agent._id,
      email,
      passwordHash,
      role: "agent",
    });

    await logAction({
      type: "user",
      action: "agent_created",
      performedBy: req.user.id, // assuming you use middleware
      targetUser: agent._id,
      details: { name: fullName, email },
    });

    res.status(201).json({ message: "Agent created successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to create agent", error: err.message });
  }
};

export const createAdmin = async (req, res) => {
  const { fullName, email, phoneNumber, password, department } = req.body;

  try {
    const exists = await Auth.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "Admin already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      fullName,
      email,
      phoneNumber,
      department,
    });
    await Auth.create({
      userId: admin._id,
      email,
      passwordHash,
      role: "admin",
    });

    res.status(201).json({ message: "Admin created successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to create admin", error: err.message });
  }
};

export const getCustomerDetails = async (req, res) => {
  try {
    const customerId = req.params.id;

    console.log("customerId", customerId);

    const customer = await Customer.findById(customerId).lean();
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching customer details",
      error: error.message,
    });
  }
};

export const getAgentDetails = async (req, res) => {
  try {
    const agentId = req.user.id;

    const agent = await Agent.findById(agentId).lean();
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    res.status(200).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching agent details",
      error: error.message,
    });
  }
};

export const getAdminDetails = async (req, res) => {
  try {
    const adminId = req.user.id;

    const admin = await Admin.findById(adminId).lean();
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching admin details",
      error: error.message,
    });
  }
};

export const getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({}).lean();
    console.log("All customers in database:", customers.length);
    console.log("Customers:", customers);

    res.status(200).json({
      success: true,
      data: customers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching customers",
      error: error.message,
    });
  }
};
