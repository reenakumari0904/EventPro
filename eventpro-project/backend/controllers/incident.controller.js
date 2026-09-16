import { query } from "../config/db.js";

const SEVERITY_MAP = {
  medical_emergency: "critical",
  security: "critical",
  power_failure: "critical",
  network_outage: "critical",
  overcrowding: "critical",
  venue_evacuation: "critical",
  major_system_failure: "critical",
  large_scale_registration_failure: "critical",
  speaker_cancellation: "high",
  av_failure: "high",
  venue_technical: "high",
  registration_failure: "high",
  session_delay: "high",
  missing_equipment: "medium",
  vip_issue: "medium",
  other: "medium",
};
function classifySeverity(incidentType) {
  return SEVERITY_MAP[incidentType] || "medium";
}

const SEVERITY_ORDER = ["low", "medium", "high", "critical"];
function nextSeverityUp(current) {
  const idx = SEVERITY_ORDER.indexOf(current);
  return idx >= 0 && idx < SEVERITY_ORDER.length - 1 ? SEVERITY_ORDER[idx + 1] : current;
}


async function insertAlertForIncident(incident, { escalated = false } = {}) {
  const level = incident.severity === "low" ? "informational" : incident.severity;
  const title = escalated ? `Escalated: ${incident.title}` : incident.title;
  const message = escalated
    ? `Incident #${incident.incident_id} was escalated to ${incident.severity.toUpperCase()} severity.`
    : `New ${incident.severity} incident reported: ${incident.description || incident.title}`;
  await query(
    `INSERT INTO operational_alerts (alert_level, source_type, source_id, title, message, is_ai_generated)
     VALUES ($1, 'incident', $2, $3, $4, false)`,
    [level, incident.incident_id, title, message]
  );
}

// Core create-incident logic, extracted so the HTTP handler below and the
// Agent Orchestration workflows (services/workflows/*) can both create
// incidents without depending on Express req/res.
export async function createIncidentRecord({ title, description, incident_type, session_id, venue_id, reported_by, severity }) {
  if (!title || !incident_type) throw new Error("title and incident_type are required.");

  const finalSeverity = severity || classifySeverity(incident_type);

  const result = await query(
    `INSERT INTO incidents (title, description, incident_type, severity, session_id, venue_id, reported_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [title, description || null, incident_type, finalSeverity, session_id || null, venue_id || null, reported_by || null]
  );
  const incident = result.rows[0];

  await query(
    `INSERT INTO incident_workflow_log (incident_id, from_status, to_status, action, notes, actor)
     VALUES ($1, NULL, 'reported', 'created', $2, $3)`,
    [incident.incident_id, `Auto-classified as ${finalSeverity} severity.`, reported_by || "system"]
  );
  await insertAlertForIncident(incident);

  return incident;
}

// POST /incidents — thin wrapper around createIncidentRecord().
export async function createIncident(req, res) {
  try {
    const incident = await createIncidentRecord(req.body);
    res.status(201).json(incident);
  } catch (err) {
    console.error("POST /incidents error:", err.message);
    res.status(err.message.includes("required") ? 400 : 500).json({ error: err.message });
  }
}

// GET /incidents — optional ?status= & ?severity= filters
export async function getIncidents(req, res) {
  try {
    const { status, severity } = req.query;
    const conditions = [];
    const params = [];
    if (status) { params.push(status); conditions.push(`i.status = $${params.length}`); }
    if (severity) { params.push(severity); conditions.push(`i.severity = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query(
      `SELECT i.*, v.name AS venue_name, s.title AS session_title
       FROM incidents i
       LEFT JOIN venues v ON v.venue_id = i.venue_id
       LEFT JOIN sessions s ON s.session_id = i.session_id
       ${where}
       ORDER BY
         CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         i.reported_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
export async function updateIncidentStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes, actor, assigned_to } = req.body;
    const valid = ["reported", "acknowledged", "in_progress", "escalated", "resolved", "closed"];
    if (!valid.includes(status)) return res.status(400).json({ error: `status must be one of: ${valid.join(", ")}` });

    const existingRow = await query(`SELECT * FROM incidents WHERE incident_id = $1`, [id]);
    const existing = existingRow.rows[0];
    if (!existing) return res.status(404).json({ error: "Incident not found." });

    const updated = await query(
      `UPDATE incidents SET status = $1, assigned_to = COALESCE($2, assigned_to),
              resolved_at = CASE WHEN $5 = 'resolved' THEN NOW() ELSE resolved_at END,
              resolution_notes = CASE WHEN $5 = 'resolved' THEN $3 ELSE resolution_notes END
       WHERE incident_id = $4 RETURNING *`,
      [status, assigned_to || null, notes || null, id, status]
    );
    const incident = updated.rows[0];

    await query(
      `INSERT INTO incident_workflow_log (incident_id, from_status, to_status, action, notes, actor)
       VALUES ($1, $2, $3, 'status_change', $4, $5)`,
      [id, existing.status, status, notes || null, actor || "system"]
    );

    res.json(incident);
  } catch (err) {
    console.error("PUT /incidents/:id/status error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
// Core escalation logic, extracted for the same reason as createIncidentRecord above.
export async function escalateIncidentRecord(id, { notes, actor } = {}) {
  const existingRow = await query(`SELECT * FROM incidents WHERE incident_id = $1`, [id]);
  const existing = existingRow.rows[0];
  if (!existing) {
    const err = new Error("Incident not found.");
    err.status = 404;
    throw err;
  }

  const newSeverity = nextSeverityUp(existing.severity);
  const updated = await query(
    `UPDATE incidents SET severity = $1, status = 'escalated' WHERE incident_id = $2 RETURNING *`,
    [newSeverity, id]
  );
  const incident = updated.rows[0];

  await query(
    `INSERT INTO incident_workflow_log (incident_id, from_status, to_status, action, notes, actor)
     VALUES ($1, $2, 'escalated', 'escalation', $3, $4)`,
    [id, existing.status, notes || `Escalated from ${existing.severity} to ${newSeverity}.`, actor || "system"]
  );
  await insertAlertForIncident(incident, { escalated: true });

  return incident;
}

export async function escalateIncident(req, res) {
  try {
    const { id } = req.params;
    const incident = await escalateIncidentRecord(id, req.body || {});
    res.json(incident);
  } catch (err) {
    console.error("POST /incidents/:id/escalate error:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
}
export async function aiTriageIncident(req, res) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "GEMINI_API_KEY is not set in backend/.env. Get a free key at https://aistudio.google.com/apikey" });
    }
    const { title, description, incident_type } = req.body;
    if (!title) return res.status(400).json({ error: "title is required." });

    const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const prompt =
      "You are triaging an incident at a live event for an event operations team. Based on the report below, " +
      "suggest a severity level, a short recommended immediate action, and whether it needs escalation to senior " +
      'staff. Respond with ONLY valid JSON, no markdown, in this exact shape: ' +
      '{"severity": "critical|high|medium|low", "recommended_action": "<1-2 sentences>", "escalate": true|false, "reasoning": "<1 sentence>"}\n\n' +
      `Title: ${title}\nType: ${incident_type || "unspecified"}\nDescription: ${description || "none provided"}`;

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
    res.json(parsed);
  } catch (err) {
    console.error("POST /incidents/ai-triage error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /incidents/analytics — Incident dashboard: open counts, resolution time, escalations.
export async function getIncidentAnalytics(req, res) {
  try {
    const openBySeverity = await query(
      `SELECT severity, COUNT(*) AS count FROM incidents
       WHERE status NOT IN ('resolved', 'closed') GROUP BY severity`
    );
    const byType = await query(`SELECT incident_type, COUNT(*) AS count FROM incidents GROUP BY incident_type ORDER BY count DESC`);
    const avgResolution = await query(
      `SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 60)) AS avg_minutes
       FROM incidents WHERE resolved_at IS NOT NULL`
    );
    const escalationCount = await query(`SELECT COUNT(*) AS count FROM incident_workflow_log WHERE action = 'escalation'`);
    const recent = await query(
      `SELECT i.incident_id, i.title, i.incident_type, i.severity, i.status, i.reported_at, v.name AS venue_name
       FROM incidents i LEFT JOIN venues v ON v.venue_id = i.venue_id
       ORDER BY i.reported_at DESC LIMIT 10`
    );
    const workflowHistory = await query(
      `SELECT l.log_id, l.incident_id, i.title, l.from_status, l.to_status, l.action, l.notes, l.actor, l.created_at
       FROM incident_workflow_log l JOIN incidents i ON i.incident_id = l.incident_id
       ORDER BY l.created_at DESC LIMIT 15`
    );

    res.json({
      open_by_severity: openBySeverity.rows,
      by_type: byType.rows,
      avg_resolution_minutes: avgResolution.rows[0]?.avg_minutes || null,
      escalation_count: parseInt(escalationCount.rows[0]?.count || 0, 10),
      recent_incidents: recent.rows,
      workflow_history: workflowHistory.rows,
    });
  } catch (err) {
    console.error("GET /incidents/analytics error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
