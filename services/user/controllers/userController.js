import Customer from "../../user/models/customerModel.js";
import Admin from "../../user/models/adminModel.js";
import Application from "../../application/models/applicationModel.js"; // Imported from app service
import { sendOnboardingEmail } from "../../notification/utils/sendMail.js"; // External call
import Auth from "../../auth/models/authModel.js";
import Agent from "../../user/models/agentModel.js";
import bcrypt from "bcryptjs";
import { logAction } from "../../audit logs/utils/logHelper.js";

const defaultSteps = [
  "KYC",
  "Office Lease",
  "Trade License",
  "Establishment Card",
  "Visa Quota",
  "Medical",
  "Residence Visa",
  "EID Soft",
  "EID Hard",
  "VAT",
  "Corporate Tax",
  "Banking",
];

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
      businessActivity2,
      businessActivity3,
      numberOfInvestors,
      sourceOfFund,
      initialInvestment,
      investorDetails,
      password,
    } = req.body;

    const existing = await Auth.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Customer already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const customer = await Customer.create({
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
      businessActivity2,
      businessActivity3,
      numberOfInvestors,
      sourceOfFund,
      initialInvestment,
      investorDetails,
    });

    await Auth.create({
      userId: customer._id,
      email,
      passwordHash,
      role: "customer",
    });

    const steps = defaultSteps.map((step) => ({
      stepName: step,
      status: "Not Started",
      updatedAt: new Date(),
    }));

    await Application.create({
      customer: customer._id,
      assignedAgent: assignedAgentId,
      steps,
      status: "New",
    });

    await sendOnboardingEmail(email, `${firstName} ${lastName}`);

    await logAction({
      type: "user",
      action: "agent_created",
      performedBy: req.user.id, // assuming you use middleware
      targetUser: agent._id,
      details: { name: fullName, email },
    });

    res
      .status(201)
      .json({ message: "Customer created and onboarded successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating customer", error: error.message });
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

    await logAction({
      type: "user",
      action: "agent_created",
      performedBy: req.user.id, // assuming you use middleware
      targetUser: agent._id,
      details: { name: fullName, email },
    });

    res.status(201).json({ message: "Admin created successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to create admin", error: err.message });
  }
};
