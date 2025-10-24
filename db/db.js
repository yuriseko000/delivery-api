// db/db.js
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const dbDir = __dirname;
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(path.join(dbDir, "delivery.db"));
db.run("PRAGMA foreign_keys = ON;");

db.serialize(() => {
  // ===== USERS (allow same phone for different role) =====
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      profile_img TEXT,
      role TEXT CHECK(role IN ('user','rider')) NOT NULL,
      firebase_token TEXT,
      is_available INTEGER DEFAULT 1,
      UNIQUE (phone, role)                    -- ✅ สำคัญ: เบอร์ซ้ำได้ถ้าคนละ role
    );
  `);

  // ===== ADDRESSES =====
  db.run(`
    CREATE TABLE IF NOT EXISTS addresses (
      address_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      address_text TEXT,
      latitude REAL,
      longitude REAL,
      is_default INTEGER DEFAULT 0,
      address_type TEXT,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);`);

  // ===== RIDERS (ข้อมูลเพิ่มของไรเดอร์) =====
  db.run(`
    CREATE TABLE IF NOT EXISTS riders (
      rider_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      vehicle_type TEXT,
      vehicle_plate TEXT,
      vehicle_image_url TEXT,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  // ===== SHIPMENTS =====
  db.run(`
    CREATE TABLE IF NOT EXISTS shipments (
      shipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      pickup_address_id INTEGER NOT NULL,
      delivery_address_id INTEGER NOT NULL,
      description TEXT,
      status TEXT CHECK(status IN (
        'WAITING_PICKUP','RIDING_TO_PICKUP','RIDING_TO_DEST','DELIVERED'
      )) DEFAULT 'WAITING_PICKUP',
      assigned_rider_id INTEGER,
      distance_km REAL,
      price REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(user_id),
      FOREIGN KEY (receiver_id) REFERENCES users(user_id),
      FOREIGN KEY (pickup_address_id) REFERENCES addresses(address_id),
      FOREIGN KEY (delivery_address_id) REFERENCES addresses(address_id),
      FOREIGN KEY (assigned_rider_id) REFERENCES users(user_id)
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_shipments_sender ON shipments(sender_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_shipments_receiver ON shipments(receiver_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_shipments_rider ON shipments(assigned_rider_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);`);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS trg_shipments_updated
    AFTER UPDATE ON shipments
    FOR EACH ROW
    BEGIN
      UPDATE shipments SET updated_at = CURRENT_TIMESTAMP
      WHERE shipment_id = NEW.shipment_id;
    END;
  `);

  // ===== ITEMS =====
  db.run(`
    CREATE TABLE IF NOT EXISTS shipment_items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER NOT NULL,
      item_name TEXT,
      quantity INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE
    );
  `);

  // ===== STATUS HISTORY =====
  db.run(`
    CREATE TABLE IF NOT EXISTS shipment_status_history (
      shipment_status_id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER NOT NULL,
      rider_id INTEGER,
      status TEXT,
      latitude REAL,
      longitude REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
      FOREIGN KEY (rider_id) REFERENCES users(user_id)
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_hist_shipment ON shipment_status_history(shipment_id);`);

  // ===== PHOTOS =====
  db.run(`
    CREATE TABLE IF NOT EXISTS shipment_photos (
      photo_id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER NOT NULL,
      status TEXT,
      photo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE
    );
  `);

  // ===== REALTIME LOCATIONS =====
  db.run(`
    CREATE TABLE IF NOT EXISTS realtime_locations (
      location_id INTEGER PRIMARY KEY AUTOINCREMENT,
      rider_id INTEGER NOT NULL,
      shipment_id INTEGER,
      latitude REAL,
      longitude REAL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rider_id) REFERENCES users(user_id),
      FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id)
    );
  `);
});

module.exports = { db };
