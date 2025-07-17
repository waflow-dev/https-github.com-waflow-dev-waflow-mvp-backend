import { authenticateToken } from "../../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../../middleware/roleMiddleware.js";

import express from "express";

import {
  loginUser,
  forgotPassword,
  resetPassword,
  getProfile,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

router.get('/profile', authenticateToken, getProfile)

export default router;
