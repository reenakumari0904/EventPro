import { pool } from "../config/db.js";
export function getHealth(req, res) {
  res.json({
    status: "ok",
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

export async function getReadiness(req, res) {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready", database: "connected" });
  } catch (err) {
    res.status(503).json({ status: "not_ready", database: "unreachable", error: err.message });
  }
}
