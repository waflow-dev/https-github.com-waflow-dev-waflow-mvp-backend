import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import authRoutes from "./services/auth-user/routes/index.js";
import applicationRoutes from "./services/application/routes/index.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Test Route
app.get("/", (req, res) => {
  res.send("WAFLOW backend is running...");
});

app.use("/api", authRoutes);
app.use("/api/application", applicationRoutes);

export default app;
