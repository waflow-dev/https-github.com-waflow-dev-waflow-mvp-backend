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

const app = express();

const allowedOrigins = [
  "https://waflow-frontend.vercel.app",
  "http://localhost:5173",
];

// ✅ Main CORS middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ✅ Preflight support (MUST match logic above)
app.options(
  "*",
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(morgan("dev"));

// Test Route
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
