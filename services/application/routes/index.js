import express from "express";
import {
  createApplication,
  updateStepStatus,
  addNote,
  updateVisaSubStep,
  addVisaMember,
} from "../controllers/applicationController.js";

const router = express.Router();

router.post("/create", createApplication);
router.patch("/step/:appId", updateStepStatus);
router.post("/note/:appId", addNote);
router.patch("/visa-substep/:appId/:memberId", updateVisaSubStep);
router.post("/visa-member/:appId", addVisaMember);

export default router;
