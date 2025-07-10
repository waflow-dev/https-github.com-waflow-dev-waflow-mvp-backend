import express from "express";
import { createLog, getLogs } from "../controllers/auditController.js";

const router = express.Router();

router.post("/log", createLog);
router.get("/logs", getLogs);

export default router;
