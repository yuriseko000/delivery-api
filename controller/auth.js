// controller/auth.js
const express = require("express");
const { db } = require("../db/db");
const router = express.Router();

/** ยูทิลเล็ก ๆ */
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}
function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

/** ===================== Register: User ===================== */
router.post("/register", async (req, res) => {
  try {
    const { name, phone, password, profile_img, addresses } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ success: false, message: "กรอกข้อมูลให้ครบ" });
    }

    // มี user สำหรับเบอร์นี้แล้วหรือยัง
    const exist = await get(
      db,
      "SELECT 1 FROM users WHERE phone = ? AND role = 'user' LIMIT 1",
      [phone]
    );
    if (exist) {
      return res
        .status(400)
        .json({ success: false, message: "เบอร์นี้สมัครเป็นผู้ใช้แล้ว" });
    }

    // สร้าง user role=user
    const ins = await run(
      db,
      `INSERT INTO users (phone, password, name, profile_img, role)
       VALUES (?,?,?,?, 'user')`,
      [phone, password, name, profile_img || null]
    );
    const userId = ins.lastID;

    // บันทึกที่อยู่ (ถ้ามี)
    if (Array.isArray(addresses) && addresses.length) {
      const stmt = db.prepare(`
        INSERT INTO addresses (user_id, address_text, latitude, longitude, is_default, address_type)
        VALUES (?,?,?,?,?,?)
      `);
      for (const a of addresses) {
        stmt.run([
          userId,
          a.address_text ?? null,
          a.latitude ?? null,
          a.longitude ?? null,
          a.is_default ? 1 : 0,
          a.address_type ?? null,
        ]);
      }
      stmt.finalize();
    }

    return res.status(201).json({
      success: true,
      message: "สมัครสมาชิก (User) สำเร็จ",
      user: { id: userId, name, phone, role: "user" },
    });
  } catch (e) {
    console.error("register user error:", e);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

/** ===================== Register: Rider ===================== */
router.post("/registerRider", async (req, res) => {
  try {
    const {
      phone,
      password,
      name,
      profile_img,          // ภาพยืนยันตัวตน (โปรไฟล์)
      vehicle_img,          // ภาพยานพาหนะ
      vehicle_type,
      vehicle_plate,
    } = req.body;

    if (!phone || !password || !name) {
      return res.status(400).json({ success: false, message: "กรอกข้อมูลให้ครบ" });
    }

    // เบอร์นี้มี rider แล้วหรือยัง
    const exist = await get(
      db,
      "SELECT 1 FROM users WHERE phone = ? AND role = 'rider' LIMIT 1",
      [phone]
    );
    if (exist) {
      return res
        .status(400)
        .json({ success: false, message: "เบอร์นี้สมัครเป็นไรเดอร์แล้ว" });
    }

    // สร้าง user role=rider
    const ins = await run(
      db,
      `INSERT INTO users (phone, password, name, profile_img, role)
       VALUES (?,?,?,?, 'rider')`,
      [phone, password, name, profile_img || null]
    );
    const riderUserId = ins.lastID;

    // ใส่ข้อมูลเฉพาะไรเดอร์
    await run(
      db,
      `INSERT INTO riders (user_id, vehicle_type, vehicle_plate, vehicle_image_url)
       VALUES (?,?,?,?)`,
      [riderUserId, vehicle_type || null, vehicle_plate || null, vehicle_img || null]
    );

    return res.status(201).json({
      success: true,
      message: "สมัครสมาชิก (Rider) สำเร็จ",
      user: { id: riderUserId, name, phone, role: "rider" },
    });
  } catch (e) {
    console.error("register rider error:", e);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

/** ===================== Login ===================== */
/**
 * ตามโจทย์: แยกบทบาทด้วย “รหัสผ่าน”
 * - ผู้ใช้กรอกเบอร์ + รหัสผ่าน
 * - ระบบหารายการที่ phone และ password ตรงกัน -> จะได้ role ของแถวที่ match
 * - ถ้าไม่เจอเลย -> 401
 */
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res
        .status(400)
        .json({ success: false, message: "กรุณากรอกหมายเลขโทรศัพท์และรหัสผ่าน" });
    }

    const row = await get(
      db,
      `SELECT user_id, name, phone, role
       FROM users
       WHERE phone = ? AND password = ?
       LIMIT 1`,
      [phone, password]
    );

    if (!row) {
      // (optional) ช่วยบอกว่ามีเบอร์นี้แต่เป็นอีก role หรือ password ไม่ตรง
      const hasPhone = await get(db, `SELECT 1 FROM users WHERE phone=? LIMIT 1`, [phone]);
      return res.status(401).json({
        success: false,
        message: hasPhone
          ? "รหัสผ่านไม่ถูกต้อง"
          : "ไม่พบบัญชีจากหมายเลขโทรศัพท์นี้",
      });
    }

    return res.json({
      success: true,
      message: "เข้าสู่ระบบสำเร็จ",
      user: {
        id: row.user_id,
        name: row.name,
        phone: row.phone,
        role: row.role, // 'user' หรือ 'rider' (ขึ้นกับรหัสผ่านที่ตรง)
      },
    });
  } catch (e) {
    console.error("login error:", e);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

module.exports = router; // ✅ ไม่ต้องใส่ { router }

