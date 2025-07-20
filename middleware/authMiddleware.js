import jwt from "jsonwebtoken";
import Auth from "../services/auth/models/authModel.js";

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ message: "Unauthorized: No token" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await Auth.findOne({ userId: decoded.id }).select("-password");

    console.log(user);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }
    req.user = user; // contains id and role
    // Always set req.user.id to user.userId (if present) as a string
    if (req.user.userId) {
      req.user.id = req.user.userId.toString();
    } else if (req.user._id) {
      req.user.id = req.user._id.toString();
    }
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
