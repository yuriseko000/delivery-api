const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// ✅ สร้างโฟลเดอร์ uploads ถ้ายังไม่มี
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ✅ ตั้งค่า multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ✅ อัปโหลดได้หลายรูป (ใช้ใน rider)
router.post("/multiple", upload.array("images", 5), (req, res) => {
  if (!req.files) return res.status(400).json({ success: false, message: "ไม่พบไฟล์" });

  const urls = req.files.map((f) => `/uploads/${f.filename}`);
  return res.json({ success: true, message: "อัปโหลดสำเร็จ", urls });
});

// ✅ อัปโหลดได้รูปเดียว (ใช้ใน user)
router.post("/", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "ไม่พบไฟล์" });

  return res.json({
    success: true,
    message: "อัปโหลดสำเร็จ",
    url: `/uploads/${req.file.filename}`,
  });
});

module.exports = router; // ✅ ไม่ต้องใส่ { router }

