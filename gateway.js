import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import morgan from "morgan";
import cors from "cors";

const app = express();
const USER_SERVICE_URL = "http://localhost:5001";

app.use(cors());
app.use(morgan("dev"));

// Proxy /api/user/* to user service
app.use(
  "/api/user",
  createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/user": "/api/user" },
    logLevel: "debug",
  })
);

// Health check
app.get("/", (req, res) => {
  res.send("API Gateway is running...");
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
}); 