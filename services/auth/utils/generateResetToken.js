import jwt from "jsonwebtoken";

export const generateResetToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_RESET_SECRET, {
    expiresIn: "10m",
  });
};
