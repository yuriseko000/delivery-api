import express from "express";
import { router as upload } from "./controller/upload";
import cors from "cors";

export const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use("/upload", upload);
app.use("/uploads", express.static("uploads"));
