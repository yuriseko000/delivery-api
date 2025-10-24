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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ====== ROUTES ======
const upload = require("./controller/upload");
const authRoutes = require("./controller/auth");
const addressRoutes = require("./controller/address");
const riderRoutes = require("./controller/rider");
const shipmentRoutes = require("./controller/shipments");
const locationRoutes = require("./controller/location");
const userRoutes = require("./controller/users");

console.log("🔍 upload:", require("./controller/upload"));
console.log("🔍 auth:", require("./controller/auth"));
console.log("🔍 address:", require("./controller/address"));
console.log("🔍 rider:", require("./controller/rider"));
console.log("🔍 shipments:", require("./controller/shipments"));
console.log("🔍 location:", require("./controller/location"));
console.log("🔍 users:", require("./controller/users"));

app.use("/upload", upload);
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

// ====== START SERVER ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = { app, db };
