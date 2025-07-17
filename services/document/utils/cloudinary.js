import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

export const uploadOnCloudinary = async (localFilePath) => {
  let response = null;
  try {
    if (!localFilePath) {
      throw new Error("Local file path is required");
    }
    response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    console.log("File uploaded to Cloudinary:", response.url);
    return response;
  } catch (error) {
    console.error("Cloudinary upload error:", error.message);
    return null;
  } finally {
    if (localFilePath) {
      try {
        fs.unlinkSync(localFilePath);
        console.log("Temporary file deleted:", localFilePath);
      } catch (unlinkError) {
        console.error("Error deleting temporary file:", unlinkError.message);
      }
    }
  }
};