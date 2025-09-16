import express from "express";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

export const router = express.Router();

class FileMiddleware {
  filename = "";
  constructor() {
    const uploadsDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }
  public readonly diskLoader = multer({
    storage: multer.diskStorage({
      // Set the destination folder for the uploaded files
      destination: (_req, _file, cb) => {
        cb(null, path.join(__dirname, "../uploads"));
      },
      // Set the unique filename for the uploaded file
      filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4();
        this.filename = uniqueSuffix + "." + file.originalname.split(".").pop();
        cb(null, this.filename);
      },
    }),
    limits: {
      fileSize: 67108864, // 64 MByte
    },
  });
}

const fileUpload = new FileMiddleware();

// Route to upload a file
router.post("/", fileUpload.diskLoader.single("file"), (req, res) => {
  res.json({ filename: fileUpload.filename });
});
router.get("/:filename", (req, res) => {
  const filename = req.params.filename;
  const download = req.query.download || undefined;
  if (download === "true") {
    res.download(path.join(__dirname, "../uploads", filename));
  } else {
    res.sendFile(path.join(__dirname, "../uploads", filename));
  }
});
