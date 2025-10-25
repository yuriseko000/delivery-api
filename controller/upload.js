const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();

// ====== ตั้งค่าโฟลเดอร์เก็บรูป ======
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ====== ตั้งค่า Multer สำหรับอัปโหลด ======
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    cb(null, name);
  },
});

const upload = multer({ storage });

// ====== API: อัปโหลดไฟล์ ======
router.post("/", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "ไม่พบไฟล์" });
    }

    // ✅ คืน URL กลับไปให้ Flutter ใช้
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    return res.json({
      success: true,
      message: "อัปโหลดสำเร็จ",
      url: fileUrl,
    });
  } catch (e) {
    console.error("upload error:", e);
    res.status(500).json({ success: false, message: "อัปโหลดไม่สำเร็จ" });
  }
});

module.exports = router;
