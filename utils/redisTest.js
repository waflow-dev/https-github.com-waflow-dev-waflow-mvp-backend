import redis from "./redisClient.js";

const testRedis = async () => {
  try {
    await redis.set("test_key", "Hello Redis");
    const value = await redis.get("test_key");
    console.log("✅ Redis test value:", value);
  } catch (error) {
    console.error("❌ Redis test failed:", error.message);
  }
};

testRedis();
