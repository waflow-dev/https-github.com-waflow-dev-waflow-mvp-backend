import axios from "axios";

export const logAction = async ({
  type,
  action,
  performedBy,
  targetUser,
  details = {},
}) => {
  try {
    // For server-to-server communication, use the same server
    const baseUrl =
      process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    await axios.post(`${baseUrl}/api/audit/log`, {
      type,
      action,
      performedBy,
      targetUser,
      details,
    });
  } catch (err) {
    console.error("🔴 Failed to log audit:", err.message);
  }
};
