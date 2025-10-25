const express = require("express");
const cors = require("cors");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// ====== CONFIG DATABASE ======
const dbDir = path.join(__dirname, "db");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, "delivery.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ Database connection failed:", err);
  else console.log("✅ Connected to SQLite database");
});

db.run("PRAGMA foreign_keys = ON;");

// ====== EXPRESS CONFIG ======
const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== UPLOAD STATIC FOLDER ======

// ====== ROUTES ======
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ====== ROUTES ======
const uploadRoute = require("./controller/upload");
const authRoutes = require("./controller/auth");
const addressRoutes = require("./controller/address");
const riderRoutes = require("./controller/rider");
const shipmentRoutes = require("./controller/shipments");
const locationRoutes = require("./controller/location");
const userRoutes = require("./controller/users");

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/upload", uploadRoute);
app.use("/api/auth", authRoutes);
app.use("/api/address", addressRoutes);
app.use("/api/rider", riderRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/user", userRoutes);

// ====== TEST ROUTE ======
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Delivery API is running successfully with SQLite on Render!",
  });
});

// ====== CHECK TABLES ======
app.get("/check-tables", (req, res) => {
  db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ tables: rows });
  });
});

// ====== TEMP ROUTE: DOWNLOAD DATABASE FILE ======
const fs = require("fs");
const path = require("path");

// กำหนด path ของไฟล์ฐานข้อมูล (ตรงกับของนาย)
const SQLITE_FILE = path.join(__dirname, "db", "delivery.db");

// ใช้ตัวแปรจาก Environment บน Render เพื่อเปิด/ปิดการดาวน์โหลด
const ENABLE_DB_DOWNLOAD = process.env.ENABLE_DB_DOWNLOAD === "true";
const DB_DOWNLOAD_TOKEN = process.env.DB_DOWNLOAD_TOKEN || "";

app.get("/download-db", (req, res) => {
  try {
    if (!ENABLE_DB_DOWNLOAD) {
      return res.status(403).json({ success: false, message: "DB download disabled" });
    }

    // ตรวจ token ก่อนโหลด
    const token = req.query.token || req.headers["x-db-token"];
    if (!token || token !== DB_DOWNLOAD_TOKEN) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!fs.existsSync(SQLITE_FILE)) {
      return res.status(404).json({ success: false, message: "Database file not found" });
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", 'attachment; filename="delivery.db"');
    res.setHeader("Cache-Control", "no-store");

    const stream = fs.createReadStream(SQLITE_FILE);
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) res.status(500).send("Streaming error");
    });
    stream.pipe(res);
  } catch (e) {
    console.error("Download DB error:", e);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
// ====== END TEMP ROUTE ======


// ====== START SERVER ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = { app, db };
