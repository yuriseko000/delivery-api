import express from "express";
import { router as upload } from "./controller/upload";

export const app = express();

app.use("/upload", upload);
app.use("/uploads", express.static("uploads"));
