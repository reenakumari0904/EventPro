import express from "express";
import { query } from "../config/db.js";

const router = express.Router();

// GET /events
router.get("/events", async (req, res) => {
  try {
    const result = await query(`SELECT * FROM events ORDER BY date ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
