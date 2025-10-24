const express = require("express");
const router = express.Router();
const { db } = require("../db/db");

// ✅ ตัวอย่าง route rider เบื้องต้น (กัน error)
router.get("/", (req, res) => {
  res.json({ message: "Rider route is working" });
});

module.exports = router;
