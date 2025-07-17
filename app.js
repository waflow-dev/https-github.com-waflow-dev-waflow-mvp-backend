import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import authRoutes from "./services/auth/routes/index.js";
import applicationRoutes from "./services/application/routes/index.js";
import documentRoutes from "./services/document/routes/index.js";
import userRoutes from "./services/user/routes/index.js";
import auditRoutes from "./services/audit logs/routes/index.js";
import dashboardRoutes from "./services/dashboard/routes/index.js";
import notificationRoutes from "./services/notification/routes/index.js";

dotenv.config();


const allowedOrigins = [
  "https://waflow-frontend.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080"
];

const corsHeaders = (req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
};

// Place this before any other middleware
const app = express();
app.use(corsHeaders);

app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.send("WAFLOW backend is running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/application", applicationRoutes);
app.use("/api/document", documentRoutes);
app.use("/api/user", userRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notification", notificationRoutes);

export default app;
