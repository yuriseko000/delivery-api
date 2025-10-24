const express = require("express");
const { db } = require("../db/db");
const router = express.Router();

function toRad(x){ return x*Math.PI/180; }
function haversine(lat1, lon1, lat2, lon2){
  const R=6371000; // meters
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a)); // meters
}

// ===== สร้างงาน =====
router.post("/", (req,res)=>{
  const {
    sender_id, receiver_phone, pickup_address_id, delivery_address_id,
    description, items // [{item_name, quantity}]
  } = req.body;

  if(!sender_id || !receiver_phone || !pickup_address_id || !delivery_address_id){
    return res.status(400).json({ success:false, message:"missing fields" });
  }

  db.get("SELECT user_id FROM users WHERE phone = ?", [receiver_phone], (err, receiver)=>{
    if(err) return res.status(500).json({ success:false, message:"DB error" });
    if(!receiver) return res.status(400).json({ success:false, message:"receiver not found" });

    db.run(`INSERT INTO shipments (sender_id,receiver_id,pickup_address_id,delivery_address_id,description)
            VALUES (?,?,?,?,?)`,
      [sender_id, receiver.user_id, pickup_address_id, delivery_address_id, description||null],
      function(err2){
        if(err2) return res.status(500).json({ success:false, message:"create failed" });
        const shipment_id = this.lastID;

        if(Array.isArray(items) && items.length>0){
          const st = db.prepare(`INSERT INTO shipment_items (shipment_id,item_name,quantity) VALUES (?,?,?)`);
          items.forEach(it => st.run([shipment_id, it.item_name||null, it.quantity||1]));
          st.finalize(()=> res.json({ success:true, shipment_id }));
        }else{
          res.json({ success:true, shipment_id });
        }
      }
    );
  });
});

// ===== รายการของฉัน (sender/receiver/rider) =====
router.get("/list", (req,res)=>{
  const { user_id, as } = req.query; // as=sender|receiver|rider
  let sql, params=[user_id];

  if(as==="sender")      sql = "SELECT * FROM shipments WHERE sender_id = ? ORDER BY created_at DESC";
  else if(as==="receiver") sql = "SELECT * FROM shipments WHERE receiver_id = ? ORDER BY created_at DESC";
  else if(as==="rider")    sql = "SELECT * FROM shipments WHERE assigned_rider_id = ? AND status IN ('RIDING_TO_PICKUP','RIDING_TO_DEST') ORDER BY created_at DESC";
  else return res.status(400).json({ success:false, message:"invalid role" });

  db.all(sql, params, (err, rows)=>{
    if(err) return res.status(500).json({ success:false, message:"DB error" });
    res.json({ success:true, shipments: rows });
  });
});

// ===== ไรเดอร์รับงาน (ครั้งละ 1, งานเดียวห้ามซ้ำ) =====
router.post("/:id/assign", (req,res)=>{
  const { id } = req.params;
  const { rider_id } = req.body;
  const io = req.app.get("io");

  // rider ต้องไม่มีงาน active
  db.get(`SELECT 1 FROM shipments WHERE assigned_rider_id=? AND status IN ('RIDING_TO_PICKUP','RIDING_TO_DEST')`,
    [rider_id], (err,row)=>{
      if(err) return res.status(500).json({ success:false, message:"DB error" });
      if(row) return res.status(400).json({ success:false, message:"rider already has an active job" });

      // งานต้องยังไม่ถูก assign
      db.get(`SELECT status,assigned_rider_id FROM shipments WHERE shipment_id=?`, [id], (err2, sp)=>{
        if(err2) return res.status(500).json({ success:false, message:"DB error" });
        if(!sp) return res.status(404).json({ success:false, message:"shipment not found" });
        if(sp.assigned_rider_id) return res.status(400).json({ success:false, message:"already assigned" });
        if(sp.status!=="WAITING_PICKUP") return res.status(400).json({ success:false, message:"invalid status" });

        db.run(`UPDATE shipments SET assigned_rider_id=?, status='RIDING_TO_PICKUP' WHERE shipment_id=?`,
          [rider_id, id], function(err3){
            if(err3) return res.status(500).json({ success:false, message:"assign fail" });

            db.run(`INSERT INTO shipment_status_history (shipment_id,rider_id,status) VALUES (?,?,?)`,
              [id, rider_id, 'RIDING_TO_PICKUP']);

            io.emit("shipment:assigned", { shipment_id: id, rider_id });
            res.json({ success:true, message:"assigned" });
          });
      });
    });
});

// ===== อัปเดตสถานะ + เช็คระยะ ≤20m + รูปประกอบสถานะ =====
// body: { rider_id, status, latitude, longitude, photo_url? }
router.post("/:id/status", (req,res)=>{
  const { id } = req.params;
  const { rider_id, status, latitude, longitude, photo_url } = req.body;
  const io = req.app.get("io");

  if(!rider_id || !status) return res.status(400).json({ success:false, message:"missing fields" });

  db.get(`SELECT * FROM shipments WHERE shipment_id=?`, [id], (err, sp)=>{
    if(err) return res.status(500).json({ success:false, message:"DB error" });
    if(!sp) return res.status(404).json({ success:false, message:"shipment not found" });
    if(sp.assigned_rider_id != rider_id) return res.status(403).json({ success:false, message:"not your job" });

    // check distance for pickup/delivery when needed
    const checkDistance = (cb)=>{
      if(!latitude || !longitude) return cb(null,true);
      // need target lat/lon from addresses
      let addrId = null;
      if(status==="RIDING_TO_DEST") {
        // ระหว่างรับสินค้าแล้วมุ่งหน้าส่ง ไม่ต้องเช็ค
        return cb(null,true);
      }
      if(status==="RIDING_TO_PICKUP"){
        // เพิ่งรับงาน มุ่งหน้าไปที่ pickup -> ไม่ต้องเช็ค
        return cb(null,true);
      }
      if(status==="DELIVERED" || status==="RIDING_TO_DEST"){
        // เมื่อกดส่งสำเร็จ ต้องอยู่ใกล้ delivery <= 20m
        addrId = sp.delivery_address_id;
      }
      if(status==="RIDING_TO_DEST"){
        return cb(null,true);
      }
      if(status==="DELIVERED" && addrId==null) return cb(null,true);

      // ถ้าเป็น DELIVERED -> ตรวจ delivery
      db.get(`SELECT latitude, longitude FROM addresses WHERE address_id=?`, [addrId], (e,a)=>{
        if(e || !a) return cb(null,true); // ผ่อนปรน
        const dist = haversine(a.latitude, a.longitude, latitude, longitude); // meters
        if(dist <= 20) cb(null,true); else cb(null,false);
      });
    };

    checkDistance((_, ok)=>{
      if(!ok) return res.status(400).json({ success:false, message:"rider too far (>20m) from target" });

      // persist status + optional photo
      db.run(`INSERT INTO shipment_status_history (shipment_id,rider_id,status,latitude,longitude) VALUES (?,?,?,?,?)`,
        [id, rider_id, status, latitude||null, longitude||null]);

      if(photo_url){
        db.run(`INSERT INTO shipment_photos (shipment_id,status,photo_url) VALUES (?,?,?)`,
          [id, status, photo_url]);
      }

      // update shipments table status
      db.run(`UPDATE shipments SET status=? WHERE shipment_id=?`, [status, id], function(err2){
        if(err2) return res.status(500).json({ success:false, message:"update fail" });

        // เมื่อส่งสำเร็จ เปลี่ยนไรเดอร์ว่าง
        if(status==="DELIVERED"){
          db.run(`UPDATE users SET is_available=1 WHERE user_id=?`, [rider_id]);
        }

        io.emit("shipment:status", { shipment_id: id, status, rider_id, latitude, longitude, photo_url });
        res.json({ success:true, message:"status updated" });
      });
    });
  });
});

// ===== ติดตามงาน (รวมสถานะล่าสุด + ตำแหน่งไรเดอร์ล่าสุด) =====
router.get("/track/:id", (req,res)=>{
  const { id } = req.params;
  db.get(`SELECT s.*, u.name as rider_name, u.phone as rider_phone
          FROM shipments s LEFT JOIN users u ON s.assigned_rider_id=u.user_id
          WHERE s.shipment_id=?`, [id], (err, sp)=>{
    if(err) return res.status(500).json({ success:false, message:"DB error" });
    if(!sp) return res.status(404).json({ success:false, message:"not found" });

    db.get(`SELECT latitude, longitude, recorded_at
            FROM realtime_locations WHERE rider_id=? AND shipment_id=?
            ORDER BY recorded_at DESC LIMIT 1`, [sp.assigned_rider_id, id], (e, loc)=>{
      db.all(`SELECT * FROM shipment_status_history WHERE shipment_id=? ORDER BY created_at DESC`, [id], (e2, hist)=>{
        res.json({ success:true, shipment: sp, last_location: loc||null, history: hist||[] });
      });
    });
  });
});

module.exports = router; // ✅ ไม่ต้องใส่ { router }

