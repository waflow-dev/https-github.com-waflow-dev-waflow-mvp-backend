import Customer from "../../user/models/customerModel.js";
import Admin from "../../user/models/adminModel.js";
import sendEmail from "../../notification/utils/sendEmail.js";
import Auth from "../../auth/models/authModel.js";
import Agent from "../../user/models/agentModel.js";
import bcrypt from "bcryptjs";
import { logAction } from "../../audit logs/utils/logHelper.js";
import { createNotification } from "../../notification/controllers/notificationController.js";
import { generateCustomId } from "../utils/generateCustomId.js";

//////////////////////////////////////////CreateUsers///////////////////////////////////////////////////////////

export const createCustomer = async (req, res) => {
  try {
    const {
      assignedAgentId,
      firstName,
      middleName,
      lastName,
      dob,
      gender,
      email,
      phoneNumber,
      nationality,
      address,
      emiratesIdNumber,
      passportNumber,
      password,
    } = req.body;

    const existing = await Auth.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Customer already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const customerId = await generateCustomId(Customer, "CX", "customerId");
    console.log(assignedAgentId);

    const customer = await Customer.create({
      assignedAgentId: assignedAgentId,
      firstName,
      middleName,
      lastName,
      dob,
      email,
      phoneNumber,
      address,
      nationality,
      gender,
      emiratesIdNumber,
      passportNumber,
      customerId,
    });

    await Auth.create({
      userId: customer._id,
      email,
      passwordHash,
      role: "customer",
      isTempPassword: true,
    });

    const agentAuth = await Auth.findOne({
      userId: assignedAgentId,
      role: "agent",
    });

    // send welcome email to customer
    await sendEmail(
      email,
      "Welcome to Waflow - Set up your account",
      `Your profile has been created. Click the link and login using the credentials provided, to set your password and access your application dashboard.
      https://waflow-frontend.vercel.app/auth
      Email : ${email}
      Password : ${password}`
    );

    // send notification email to agent
    await sendEmail(
      agentAuth.email,
      `New Customer Assigned: ${firstName} ${middleName} ${lastName}`,
      `You've been assigned to a new customer. Log in to begin onboarding them.`
    );

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
    console.error("Error creating customer:", error);
    res.status(500).json({
      message: "Error creating customer",
      error: error.message,
    });
  }
};

export const createAgent = async (req, res) => {
  const { fullName, email, phoneNumber, password } = req.body;

  if (!fullName || !email || !phoneNumber || !password) {
    return res.status(400).json({
      message:
        "All fields are required: fullName, email, phoneNumber, password",
    });
  }

  try {
    const exists = await Auth.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const agentId = await generateCustomId(Agent, "AG", "agentId");

    const agent = await Agent.create({
      fullName,
      email,
      phoneNumber,
      agentId,
      createdBy: req.user.id,
    });

    await Auth.create({
      userId: agent._id,
      email,
      passwordHash,
      role: "agent",
      isTempPassword: true,
    });

    await sendEmail(
      email,
      "You're Invited to Waflow - Set Up Your Agent Account",
      `Your profile has been created. Click the link and login using the credentials provided, to set your password and access your dashboard.
      https://waflow-frontend.vercel.app/auth
      Email : ${email}
      Password : ${password}`
    );

    await logAction({
      type: "user",
      action: "agent_created",
      performedBy: req.user.id,
      targetUser: agent._id,
      details: { name: fullName, email },
    });

    res.status(201).json({ message: "Agent created successfully" });
  } catch (err) {
    console.error("Error in createAgent:", err);
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
    const adminId = await generateCustomId(Admin, "ADM", "adminId");

    const admin = await Admin.create({
      fullName,
      email,
      phoneNumber,
      department,
      adminId,
    });

    await Auth.create({
      userId: admin._id,
      email,
      passwordHash,
      role: "admin",
      isTempPassword: true,
    });

    await sendEmail(
      email,
      "You're Invited to Manage Waflow - Activate Your Account",
      `Your profile has been created. Click the link and login using the credentials provided, to set your password and access your dashboard.
      https://waflow-frontend.vercel.app/auth
      Email : ${email}
      Password : ${password}`
    );

    await logAction({
      type: "user",
      action: "admin_created",
      performedBy: req.user.id,
      targetUser: admin._id,
      details: { name: fullName, email },
    });

    res.status(201).json({ message: "Admin created successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to create admin", error: err.message });
  }
};

///////////////////////////////////////Get user details///////////////////////////////////////////////////////////////////

export const getCustomerDetails = async (req, res) => {
  try {
    const customerId = req.params.customerId;

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
    const agentId = req.params.agentId || req.user?.id;

    if (!agentId) {
      return res.status(400).json({ message: "Agent ID is required" });
    }

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
    let customers;

    if (req.user.role === "admin") {
      // ✅ Admin sees all customers
      customers = await Customer.find({}).lean();
    } else if (req.user.role === "agent") {
      // ✅ Agent sees only their customers
      customers = await Customer.find({
        assignedAgentId: req.user.id,
      }).lean();
    } else {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to view customers",
      });
    }

    console.log("Customers fetched:", customers.length);

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

export const getAllAgents = async (req, res) => {
  try {
    const agents = await Agent.find().lean();
    res.status(200).json({ data: agents });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching agents",
      error: error.message,
    });
  }
};

//////////////////////////////////////////Update User Details////////////////////////////////////////////////////////////////

export const updateAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { fullName, phoneNumber, status, password } = req.body;

    if (!agentId) {
      return res.status(400).json({ message: "Agent ID is required" });
    }

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (status && ["active", "inactive"].includes(status)) {
      updateData.status = status;
    }

    const authUpdateData = {};
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      authUpdateData.passwordHash = passwordHash;
    }
    if (status && ["active", "inactive"].includes(status)) {
      authUpdateData.isActive = status === "active";
    }

    if (
      Object.keys(updateData).length === 0 &&
      Object.keys(authUpdateData).length === 0
    ) {
      return res
        .status(400)
        .json({ message: "No valid fields provided for update" });
    }

    const authUpdatedAgent = await Auth.findOneAndUpdate(
      { userId: agentId },
      authUpdateData,
      { new: true }
    );

    if (!authUpdatedAgent) {
      return res.status(404).json({ message: "Auth record not found" });
    }

    const updatedAgent = await Agent.findByIdAndUpdate(agentId, updateData, {
      new: true,
    });

    if (!updatedAgent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    await logAction({
      type: "user",
      action: "agent_updated",
      performedBy: req.user.id,
      targetUser: agentId,
      details: { ...updateData, ...(password && { passwordUpdated: true }) },
    });

    res.status(200).json({
      success: true,
      message: "Agent updated successfully",
      data: updatedAgent,
      authData: {
        email: authUpdatedAgent.email,
        isActive: authUpdatedAgent.isActive,
      },
    });
  } catch (error) {
    console.error("Error updating agent:", error);
    res.status(500).json({
      success: false,
      message: "Error updating agent",
      error: error.message,
    });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const {
      firstName,
      middleName,
      lastName,
      dob,
      gender,
      phoneNumber,
      nationality,
      passportNumber,
      emiratesIdNumber,
      address,
      status,
      password,
    } = req.body;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    // Prepare customer updates
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (middleName) updateData.middleName = middleName;
    if (lastName) updateData.lastName = lastName;
    if (dob) updateData.dob = dob;
    if (gender) updateData.gender = gender;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (nationality) updateData.nationality = nationality;
    if (passportNumber) updateData.passportNumber = passportNumber;
    if (emiratesIdNumber) updateData.emiratesIdNumber = emiratesIdNumber;
    if (address) updateData.address = address;
    if (status && ["active", "inactive"].includes(status)) {
      updateData.status = status;
    }

    if (Object.keys(updateData).length === 0 && !password && !status) {
      return res
        .status(400)
        .json({ message: "No valid fields provided for update" });
    }

    // Auth-level updates
    const authUpdateData = {};
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      authUpdateData.passwordHash = passwordHash;
    }
    if (status && ["active", "inactive"].includes(status)) {
      authUpdateData.isActive = status === "active";
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      updateData,
      { new: true }
    );

    if (!updatedCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const updatedAuth = await Auth.findOneAndUpdate(
      { userId: customerId },
      authUpdateData,
      { new: true }
    );
    console.log(updatedAuth);

    if (!updatedAuth) {
      return res.status(404).json({ message: "Auth record not found" });
    }

    await logAction({
      type: "user",
      action: "customer_updated",
      performedBy: req.user.id,
      targetUser: customerId,
      details: {
        ...updateData,
        ...(password && { passwordUpdated: true }),
        ...(status && { newStatus: status }),
      },
    });

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: updatedCustomer,
      authData: {
        email: updatedAuth.email,
        isActive: updatedAuth.isActive,
      },
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({
      success: false,
      message: "Error updating customer",
      error: error.message,
    });
  }
};
