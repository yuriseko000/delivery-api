const express = require("express");
const { db } = require("../db/db");
const router = express.Router();

router.post("/rider", (req,res)=>{
  const { rider_id, shipment_id, latitude, longitude } = req.body;
  if(!rider_id || latitude==null || longitude==null){
    return res.status(400).json({ success:false, message:"missing fields" });
  }
  db.run(`INSERT INTO realtime_locations (rider_id,shipment_id,latitude,longitude) VALUES (?,?,?,?)`,
    [rider_id, shipment_id||null, latitude, longitude], (err)=>{
      if(err) return res.status(500).json({ success:false, message:"DB error" });
      const io = req.app.get("io");
      io.emit("rider:location", { rider_id, shipment_id, latitude, longitude });
      res.json({ success:true });
    });
});

module.exports = router; // ✅ ไม่ต้องใส่ { router }
