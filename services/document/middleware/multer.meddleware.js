import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     const dest = path.resolve(__dirname, "../../../public/temp");
//     fs.mkdirSync(dest, { recursive: true }); // Ensure directory exists
//     cb(null, dest);
//   },
//   filename: function (req, file, cb) {
//     cb(null, `${Date.now()}-${file.originalname}`);
//   },
// });

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only images or PDF files are allowed"), false);
  }
};

export const upload = multer({ storage, fileFilter });
