const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// 📸 อัปโหลดรูปเดียว
router.post("/", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    message: "อัปโหลดรูปสำเร็จ",
    url: imageUrl,
  });
});

// 📸 อัปโหลดหลายรูป
router.post("/multiple", upload.array("images", 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: "No files uploaded" });
  }

  const urls = req.files.map((file) => `/uploads/${file.filename}`);
  res.json({ success: true, message: "อัปโหลดหลายรูปสำเร็จ", urls });
});

module.exports = router;