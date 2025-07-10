import mongoose from "mongoose";

const workflowConfigSchema = new mongoose.Schema({
  jurisdiction: {
    type: String,
    required: true,
    unique: true,
  },
  steps: [
    {
      stepName: { type: String, required: true },
      isOptional: { type: Boolean, default: false },
    },
  ],
});

export default mongoose.model("WorkflowConfig", workflowConfigSchema);
