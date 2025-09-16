import { generateResetToken } from "../utils/generateResetToken.js";
import Auth from "../models/authModel.js";
import Admin from "../../user/models/adminModel.js";
import Agent from "../../user/models/agentModel.js";
import Customer from "../../user/models/customerModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { logAction } from "../../audit logs/utils/logHelper.js";
import sendEmail from "../../notification/utils/sendEmail.js";
import redis from "../../../utils/redisClient.js";

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

    //  If temp password, force reset
    if (userAuth.isTempPassword) {
      const token = generateResetToken(userAuth.userId); // same utility as forgot password
      return res.status(403).json({
        message: "Password reset required",
        redirectTo: `/reset-password/${token}`, // frontend uses this
        resetToken: token, // optionally give raw token if frontend handles routing
      });
    }

    const token = jwt.sign(
      {
        id: userAuth.userId,
        role: userAuth.role,
        email: userAuth.email, // Add email to payload
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // ✅ Fetch role-specific user profile
    let user;
    const { role, userId } = userAuth;

    switch (role) {
      case "admin":
        user = await Admin.findById(userId).lean();
        break;
      case "agent":
        user = await Agent.findById(userId).lean();
        break;
      case "customer":
        user = await Customer.findById(userId).lean();
        break;
      default:
        return res.status(400).json({ message: "Invalid user role" });
    }
    console.log("User: ", user);
    user.role = userAuth.role;

    if (!user) {
      return res.status(404).json({ message: "User profile not found" });
    }

    await redis.set(`session:${userAuth.userId}`, token, { ex: 86400 }); // 1 day
    await redis.set(`user:${userAuth.userId}`, JSON.stringify(user), {
      ex: 86400,
    });

    console.log("Stringified data :", JSON.stringify(user));

    await logAction({
      type: "auth",
      action: "login_success",
      performedBy: userId,
      details: { ip: req.ip },
    });

    res.status(200).json({
      token,
      role: userAuth.role,
      userId: userAuth.userId,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const logoutUser = async (req, res) => {
  const userId = req.user.id;

  try {
    await redis.del(`session:${userId}`);
    await redis.del(`user:${userId}`);

    await logAction({
      type: "auth",
      action: "logout",
      performedBy: userId,
      details: { ip: req.ip },
    });

    return res.status(200).json({
      success: true,
      message: "User logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ success: false, message: "Logout failed" });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await Auth.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = generateResetToken(user.userId);
    const resetUrl = `https://waflow-three.vercel.app/reset-password/${token}`;

    await sendEmail(
      email,
      "Reset Your Waflow Password",
      `Secure link to reset password: ${resetUrl} 
      Ignore if not requested.`
    );

    await logAction({
      type: "auth",
      action: "password_reset_requested",
      performedBy: user._id,
      details: { email },
    });

    res
      .status(200)
      .json({ message: "Password reset link sent to email", resetUrl });
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
    authUser.isTempPassword = false;
    await authUser.save();

    await logAction({
      type: "auth",
      action: "password_reset_success",
      performedBy: authUser.userId,
    });

    res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    res
      .status(400)
      .json({ message: "Invalid or expired token", error: err.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    // console.log("Inside Get Profile", req.user.id, req.user);
    const user = await Auth.findOne({ userId: req.user.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
