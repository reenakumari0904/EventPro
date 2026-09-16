import { query } from "../config/db.js";
export async function getAlerts(req, res) {
  try {
    const { acknowledged, level } = req.query;
    const conditions = [];
    const params = [];
    if (acknowledged !== undefined) { params.push(acknowledged === "true"); conditions.push(`acknowledged = $${params.length}`); }
    if (level) { params.push(level); conditions.push(`alert_level = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query(
      `SELECT * FROM operational_alerts ${where}
       ORDER BY
         CASE alert_level WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         created_at DESC
       LIMIT 50`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /alerts/:id/acknowledge
export async function acknowledgeAlert(req, res) {
  try {
    const { id } = req.params;
    const result = await query(`UPDATE operational_alerts SET acknowledged = true WHERE alert_id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Alert not found." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /alerts/:id/acknowledge error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// Core rule-based alert generation, extracted so the HTTP handler below and
// the Agent Orchestrator (services/orchestrator.js) can both trigger it
// without one depending on Express req/res objects.
export async function runAlertGeneration() {
  const created = [];
  {
    const overdueDeliverables = await query(
      `SELECT d.deliverable_id, d.description, d.due_date, s.sponsor_id, s.name AS sponsor_name
       FROM sponsor_deliverables d JOIN sponsors s ON s.sponsor_id = d.sponsor_id
       WHERE d.status = 'pending' AND d.due_date < CURRENT_DATE
         AND NOT EXISTS (
           SELECT 1 FROM operational_alerts a
           WHERE a.source_type = 'sponsor' AND a.source_id = d.deliverable_id AND a.acknowledged = false
         )`
    );
    for (const d of overdueDeliverables.rows) {
      const inserted = await query(
        `INSERT INTO operational_alerts (alert_level, source_type, source_id, title, message)
         VALUES ('high', 'sponsor', $1, $2, $3) RETURNING *`,
        [d.deliverable_id, `Sponsor deliverable failure: ${d.sponsor_name}`, `"${d.description}" for ${d.sponsor_name} was due ${new Date(d.due_date).toLocaleDateString()} and is still pending.`]
      );
      created.push(inserted.rows[0]);
    }
    const upcomingDeliverables = await query(
      `SELECT d.deliverable_id, d.description, d.due_date, s.name AS sponsor_name
       FROM sponsor_deliverables d JOIN sponsors s ON s.sponsor_id = d.sponsor_id
       WHERE d.status = 'pending' AND d.due_date >= CURRENT_DATE AND d.due_date <= CURRENT_DATE + INTERVAL '2 days'
         AND NOT EXISTS (
           SELECT 1 FROM operational_alerts a
           WHERE a.source_type = 'sponsor_task' AND a.source_id = d.deliverable_id
         )`
    );
    for (const d of upcomingDeliverables.rows) {
      const inserted = await query(
        `INSERT INTO operational_alerts (alert_level, source_type, source_id, title, message)
         VALUES ('medium', 'sponsor_task', $1, $2, $3) RETURNING *`,
        [d.deliverable_id, `Pending task: ${d.sponsor_name}`, `"${d.description}" for ${d.sponsor_name} is due ${new Date(d.due_date).toLocaleDateString()} — coming up soon.`]
      );
      created.push(inserted.rows[0]);
    }
    const lowEngagement = await query(
      `SELECT s.sponsor_id, s.name, COUNT(e.engagement_id) AS event_count
       FROM sponsors s JOIN sponsor_engagement e ON e.sponsor_id = s.sponsor_id
       GROUP BY s.sponsor_id, s.name
       HAVING COUNT(e.engagement_id) > 0 AND COUNT(e.engagement_id) < 3`
    );
    for (const s of lowEngagement.rows) {
      const exists = await query(
        `SELECT 1 FROM operational_alerts WHERE source_type = 'sponsor_engagement' AND source_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [s.sponsor_id]
      );
      if (exists.rows.length > 0) continue;
      const inserted = await query(
        `INSERT INTO operational_alerts (alert_level, source_type, source_id, title, message)
         VALUES ('medium', 'sponsor_engagement', $1, $2, $3) RETURNING *`,
        [s.sponsor_id, `Low sponsor engagement: ${s.name}`, `${s.name} only has ${s.event_count} engagement event(s) logged so far — worth checking in.`]
      );
      created.push(inserted.rows[0]);
    }
    const capacityRisk = await query(
      `SELECT s.session_id, s.title, v.venue_id, v.name AS venue_name, v.capacity,
              COUNT(sa.attendance_id) AS current_attendance
       FROM sessions s
       JOIN venues v ON v.venue_id = s.venue_id
       LEFT JOIN session_attendance sa ON sa.session_id = s.session_id
       WHERE s.start_time <= NOW() AND s.end_time >= NOW()
       GROUP BY s.session_id, s.title, v.venue_id, v.name, v.capacity
       HAVING v.capacity > 0 AND (COUNT(sa.attendance_id)::decimal / v.capacity) >= 0.8`
    );
    for (const c of capacityRisk.rows) {
      const pct = Math.round((c.current_attendance / c.capacity) * 100);
      const exists = await query(
        `SELECT 1 FROM operational_alerts WHERE source_type = 'capacity' AND source_id = $1 AND acknowledged = false AND created_at > NOW() - INTERVAL '1 hour'`,
        [c.session_id]
      );
      if (exists.rows.length > 0) continue;
      const inserted = await query(
        `INSERT INTO operational_alerts (alert_level, source_type, source_id, title, message)
         VALUES ('high', 'capacity', $1, $2, $3) RETURNING *`,
        [c.session_id, `${c.venue_name} near capacity`, `${c.venue_name} is at ${pct}% capacity during "${c.title}" (${c.current_attendance}/${c.capacity}).`]
      );
      created.push(inserted.rows[0]);
    }
    const startingSoon = await query(
      `SELECT s.session_id, s.title, v.name AS venue_name, s.start_time
       FROM sessions s LEFT JOIN venues v ON v.venue_id = s.venue_id
       WHERE s.start_time > NOW() AND s.start_time <= NOW() + INTERVAL '15 minutes'
         AND NOT EXISTS (
           SELECT 1 FROM operational_alerts a WHERE a.source_type = 'schedule' AND a.source_id = s.session_id
         )`
    );
    for (const s of startingSoon.rows) {
      const inserted = await query(
        `INSERT INTO operational_alerts (alert_level, source_type, source_id, title, message)
         VALUES ('informational', 'schedule', $1, $2, $3) RETURNING *`,
        [s.session_id, `Starting soon: ${s.title}`, `"${s.title}" starts at ${new Date(s.start_time).toLocaleTimeString()} in ${s.venue_name || "an unassigned venue"}.`]
      );
      created.push(inserted.rows[0]);
    }

    return { created, count: created.length };
  }
}

// HTTP handler — thin wrapper around runAlertGeneration().
export async function generateOperationalAlerts(req, res) {
  try {
    const result = await runAlertGeneration();
    res.json(result);
  } catch (err) {
    console.error("POST /alerts/generate error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

export async function generateAiPredictiveAlert(req, res) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "GEMINI_API_KEY is not set in backend/.env. Get a free key at https://aistudio.google.com/apikey" });
    }

    const trend = await query(
      `SELECT s.session_id, s.title, v.name AS venue_name, v.capacity,
              COUNT(sa.attendance_id) FILTER (WHERE sa.checked_in_at > NOW() - INTERVAL '10 minutes') AS checkins_last_10min,
              COUNT(sa.attendance_id) AS total_checked_in
       FROM sessions s
       JOIN venues v ON v.venue_id = s.venue_id
       LEFT JOIN session_attendance sa ON sa.session_id = s.session_id
       WHERE s.start_time <= NOW() AND s.end_time >= NOW()
       GROUP BY s.session_id, s.title, v.name, v.capacity
       HAVING v.capacity > 0`
    );

    if (trend.rows.length === 0) {
      return res.json({ alert: null, message: "No sessions currently in progress to analyze." });
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const prompt =
      "You monitor a live event's room capacity in real time. Given current occupancy and how fast people are " +
      "arriving, decide if an operational alert is warranted (e.g. deploy more staff, prepare overflow, or nothing " +
      'needed). Respond with ONLY valid JSON, no markdown, in this exact shape: ' +
      '{"session_id": <number or null>, "alert_needed": true|false, "alert_level": "critical|high|medium|informational", "message": "<1-2 sentence alert, in the style of a live ops notification>"}\n\n' +
      `Current sessions in progress:\n${JSON.stringify(trend.rows, null, 2)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return res.status(502).json({ error: errBody?.error?.message || "Gemini API request failed." });
    }
    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());

    if (!parsed.alert_needed) {
      return res.json({ alert: null, reasoning: parsed.message });
    }

    const inserted = await query(
      `INSERT INTO operational_alerts (alert_level, source_type, source_id, title, message, is_ai_generated)
       VALUES ($1, 'capacity', $2, 'AI-predicted capacity alert', $3, true) RETURNING *`,
      [parsed.alert_level || "medium", parsed.session_id || null, parsed.message]
    );
    res.json({ alert: inserted.rows[0] });
  } catch (err) {
    console.error("POST /alerts/ai-predict error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
