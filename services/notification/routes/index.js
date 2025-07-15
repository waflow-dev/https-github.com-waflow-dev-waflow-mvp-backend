import express from "express";
import { sendGeneralEmail } from "../controllers/emailController.js";

const router = express.Router();

router.post("/send", sendGeneralEmail);

export default router;
