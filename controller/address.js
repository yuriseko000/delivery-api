const express = require("express");
const router = express.Router();
const { db } = require("../db/db");

// ✅ ตัวอย่าง route address เบื้องต้น (กัน error)
router.get("/", (req, res) => {
  res.json({ message: "Address route is working" });
});

module.exports = router;
