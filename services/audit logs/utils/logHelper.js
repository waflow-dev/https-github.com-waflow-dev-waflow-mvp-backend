import axios from "axios";

export const logAction = async ({
  type,
  action,
  performedBy,
  targetUser,
  details = {},
}) => {
  try {
    // Use local audit endpoint instead of external URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
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
