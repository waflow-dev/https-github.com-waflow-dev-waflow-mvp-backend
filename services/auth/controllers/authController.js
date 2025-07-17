import { generateResetToken } from "../utils/generateResetToken.js";
import Auth from "../models/authModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { logAction } from "../../audit logs/utils/logHelper.js";
import sendEmail from "../../notification/utils/sendEmail.js";

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
        email: userAuth.email, // Add email to payload
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    await logAction({
      type: "auth",
      action: "login_success",
      performedBy: userAuth.userId,
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

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await Auth.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = generateResetToken(user.userId);
    const resetUrl = `http://localhost:5000/reset-password/${token}`;

    // await sendEmail(
    //   email,
    //   "Reset Your Password",
    //   `Click the link: ${resetUrl}`
    // );

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
    const user = await Auth.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
