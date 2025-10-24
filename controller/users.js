const express = require("express");
const { db } = require("../db/db");
const router = express.Router();

// ค้นหาผู้ใช้จากหมายเลขโทรศัพท์ (ใช้ตอน Sender เลือก Receiver)
router.get("/by-phone/:phone", (req, res) => {
  const { phone } = req.params;
  db.get("SELECT user_id, phone, name FROM users WHERE phone = ?", [phone], (err, row) => {
    if (err) return res.status(500).json({ success:false, message:"DB error" });
    if (!row) return res.json({ success:true, found:false });
    return res.json({ success:true, found:true, user: row });
  });
});

// ที่อยู่ทั้งหมดของ user
router.get("/:user_id/addresses", (req, res) => {
  const { user_id } = req.params;
  db.all("SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, address_id DESC", [user_id], (err, rows) => {
    if (err) return res.status(500).json({ success:false, message:"DB error" });
    res.json({ success:true, addresses: rows });
  });
});

// เพิ่มที่อยู่หลายรายการ (รับ array)
router.post("/:user_id/addresses", (req, res) => {
  const { user_id } = req.params;
  const { addresses } = req.body; // [{address_text, latitude, longitude, is_default, address_type}, ...]

  if (!Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ success:false, message:"addresses must be a non-empty array" });
  }

  const stmt = db.prepare(`INSERT INTO addresses (user_id,address_text,latitude,longitude,is_default,address_type)
                           VALUES (?,?,?,?,?,?)`);
  db.serialize(() => {
    addresses.forEach(a => {
      stmt.run([user_id, a.address_text||null, a.latitude||null, a.longitude||null, a.is_default?1:0, a.address_type||null]);
    });
    stmt.finalize((err)=> {
      if (err) return res.status(500).json({ success:false, message:"Insert error" });
      res.json({ success:true, message:"addresses added" });
    });
  });
});

module.exports = router; // ✅ ไม่ต้องใส่ { router }

