import Customer from "../models/customerModel.js";
import Admin from "../models/adminModel.js";
import Application from "../../application/models/applicationModel.js"; // Imported from app service
import { sendOnboardingEmail } from "../../notification/utils/sendMail.js"; // External call
import { generateResetToken } from "../utils/generateResetToken.js";
import Auth from "../models/authModel.js";
import Agent from "../models/agentModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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
    res
      .status(201)
      .json({ message: "Customer created and onboarded successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating customer", error: error.message });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const userAuth = await Auth.findOne({ email });
    if (!userAuth || !userAuth.isActive)
      return res
        .status(401)
        .json({ message: "Invalid email or disabled account." });

    const isMatch = await bcrypt.compare(password, userAuth.passwordHash);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign(
      {
        id: userAuth.userId,
        role: userAuth.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      token,
      role: userAuth.role,
      userId: userAuth.userId,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
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

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await Auth.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = generateResetToken(user.userId);
    const resetUrl = `https://your-frontend.com/reset-password/${token}`;

    await sendEmail(
      email,
      "Reset Your Password",
      `Click the link: ${resetUrl}`
    );

    res.status(200).json({ message: "Password reset link sent to email" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error sending reset link", error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);
    const userId = decoded.userId;

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const authUser = await Auth.findOne({ userId });
    if (!authUser) return res.status(404).json({ message: "User not found" });

    authUser.passwordHash = passwordHash;
    await authUser.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    res
      .status(400)
      .json({ message: "Invalid or expired token", error: err.message });
  }
};
