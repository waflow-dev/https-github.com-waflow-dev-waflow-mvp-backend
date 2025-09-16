import jwt from "jsonwebtoken";
import redis from "../utils/redisClient.js";
import Auth from "../services/auth/models/authModel.js";

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.id;

    // 1. Validate token from Redis
    const redisToken = await redis.get(`session:${userId}`);
    // console.log("Redis token:", redisToken);
    if (!redisToken || redisToken !== token) {
      return res
        .status(403)
        .json({ message: "Session expired or invalid token" });
    }

    // 2. Fetch cached user (if available)
    let userData = await redis.get(`user:${userId}`);
    if (userData) {
      console.log("[Redis] Raw user string:", userData);
    } else {
      const userAuth = await Auth.findOne({ userId }).select("-password");
      if (!userAuth) {
        return res
          .status(401)
          .json({ message: "Unauthorized: User not found" });
      }

      const user = userAuth.toObject();

      // Re-cache user
      await redis.set(`user:${userId}`, JSON.stringify(userData), {
        ex: 86400,
      });
    }

    // 3. Attach to request
    req.user = userData;
    req.user.id = userData.userId?.toString() || userData._id?.toString();

    next();
  } catch (err) {
    console.error("[Auth Middleware] Error:", err);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
