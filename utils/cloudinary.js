import { v2 as cloudinary } from "cloudinary";

// Configure using CLOUDINARY_URL or individual keys
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true,
});

/**
 * Extract public_id and resource_type from a Cloudinary secure_url
 */
function extractFromUrl(secureUrl) {
  const u = new URL(secureUrl);
  const parts = u.pathname.split("/").filter(Boolean);

  // detect resource_type (image | video | raw)
  const rtIndex = parts.findIndex((p) => ["image", "video", "raw"].includes(p));
  if (rtIndex === -1) throw new Error("Invalid Cloudinary URL");
  const resource_type = parts[rtIndex];

  // everything after "upload/"
  const uploadIndex = parts.indexOf("upload");
  let remainder = parts.slice(uploadIndex + 1);

  // strip version (v12345)
  const vIndex = remainder.findIndex((seg) => /^v\d+$/.test(seg));
  if (vIndex !== -1) remainder = remainder.slice(vIndex + 1);

  // remove extension
  remainder[remainder.length - 1] = remainder[remainder.length - 1].replace(
    /\.[^/.]+$/,
    ""
  );

  const public_id = remainder.join("/");
  return { public_id, resource_type };
}

/**
 * Get original file size from Cloudinary secure_url
 * Returns object with bytes, size (numeric), unit ("KB"/"MB"), and display string
 */
export async function getFileSize(secureUrl) {
  const { public_id, resource_type } = extractFromUrl(secureUrl);

  const res = await cloudinary.api.resource(public_id, {
    resource_type,
  });

  const bytes = res.bytes;

  if (!bytes || isNaN(bytes)) {
    return { bytes: 0, size: 0, unit: "KB", display: "0 KB" };
  }

  if (bytes < 1024 * 1024) {
    // Less than 1 MB → show KB
    const kb = Number((bytes / 1024).toFixed(2));
    return { bytes, size: kb, unit: "KB", display: `${kb} KB` };
  } else {
    // 1 MB or more → show MB
    const mb = Number((bytes / (1024 * 1024)).toFixed(2));
    return { bytes, size: mb, unit: "MB", display: `${mb} MB` };
  }
}
