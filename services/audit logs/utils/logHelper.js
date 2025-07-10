import axios from "axios";

export const logAction = async ({
  type,
  action,
  performedBy,
  targetUser,
  details = {},
}) => {
  try {
    await axios.post(`${process.env.AUDIT_LOG_URL}/api/audit/log`, {
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
