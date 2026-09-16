import { query } from "../config/db.js";
export async function computeRecommendations() {
  const recommendations = [];
  const noEngagement = await query(
    `SELECT s.sponsor_id, s.name, s.tier FROM sponsors s
     LEFT JOIN sponsor_engagement e ON e.sponsor_id = s.sponsor_id
     WHERE e.engagement_id IS NULL`
  );
  for (const s of noEngagement.rows) {
    recommendations.push({
      category: "sponsor",
      priority: s.tier === "Platinum" || s.tier === "Gold" ? "high" : "medium",
      title: `No engagement recorded for ${s.name}`,
      message: `${s.name} (${s.tier || "unranked"}) has no logged booth visits, leads, or session participation yet. Consider a check-in call to confirm they're actually benefiting from sponsorship.`,
      related_id: s.sponsor_id,
    });
  }
  const overdue = await query(
    `SELECT d.deliverable_id, d.description, d.due_date, s.name AS sponsor_name
     FROM sponsor_deliverables d JOIN sponsors s ON s.sponsor_id = d.sponsor_id
     WHERE d.status = 'at_risk' OR (d.status = 'pending' AND d.due_date < CURRENT_DATE)`
  );
  for (const d of overdue.rows) {
    recommendations.push({
      category: "sponsor",
      priority: "high",
      title: `Overdue deliverable: ${d.sponsor_name}`,
      message: `"${d.description}" for ${d.sponsor_name} was due ${d.due_date ? new Date(d.due_date).toLocaleDateString() : "an unspecified date"} and is still not completed. Prioritize this to avoid a sponsor relations issue.`,
      related_id: d.deliverable_id,
    });
  }
  const stale = await query(
    `SELECT incident_id, title, severity, status,
            ROUND(EXTRACT(EPOCH FROM (NOW() - reported_at)) / 3600, 1) AS hours_open
     FROM incidents
     WHERE status NOT IN ('resolved', 'closed')
       AND reported_at < NOW() - INTERVAL '2 hours'
     ORDER BY hours_open DESC`
  );
  for (const i of stale.rows) {
    recommendations.push({
      category: "incident",
      priority: i.severity === "critical" || i.severity === "high" ? "high" : "medium",
      title: `Incident open ${i.hours_open}h: ${i.title}`,
      message: `"${i.title}" (${i.severity}) has been ${i.status} for ${i.hours_open} hours without resolution. Consider escalating if it's still blocking anything.`,
      related_id: i.incident_id,
    });
  }

  const unacknowledged = await query(
    `SELECT incident_id, title, severity FROM incidents
     WHERE status = 'reported' AND severity IN ('critical', 'high')`
  );
  for (const i of unacknowledged.rows) {
    recommendations.push({
      category: "incident",
      priority: "high",
      title: `Unacknowledged ${i.severity} incident: ${i.title}`,
      message: `"${i.title}" was reported as ${i.severity} severity and hasn't been acknowledged by anyone yet. This needs immediate attention.`,
      related_id: i.incident_id,
    });
  }
  const escalatedOpen = await query(`SELECT incident_id, title FROM incidents WHERE status = 'escalated'`);
  for (const i of escalatedOpen.rows) {
    recommendations.push({
      category: "incident",
      priority: "high",
      title: `Escalated and still open: ${i.title}`,
      message: `"${i.title}" was escalated but hasn't moved to in_progress or resolved yet. Confirm senior staff have picked it up.`,
      related_id: i.incident_id,
    });
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
  return recommendations;
}
export async function getRecommendations(req, res) {
  try {
    const recommendations = await computeRecommendations();
    res.json({ recommendations, count: recommendations.length });
  } catch (err) {
    console.error("GET /recommendations error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
export async function getAiRecommendationSummary(req, res) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "GEMINI_API_KEY is not set in backend/.env. Get a free key at https://aistudio.google.com/apikey" });
    }

    const recommendations = await computeRecommendations();
    if (recommendations.length === 0) {
      return res.json({ summary: "Nothing needs attention right now — no open recommendations." });
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const prompt =
      "You are an event operations assistant. Below is a list of automatically-detected issues across " +
      "sponsors and incidents. Write a short, prioritized summary (3-5 sentences) an organizer could read " +
      "in 10 seconds to know what to do next. Group similar items together, don't just list every single one.\n\n" +
      `${JSON.stringify(recommendations, null, 2)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return res.status(502).json({ error: errBody?.error?.message || "Gemini API request failed." });
    }
    const data = await response.json();
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    res.json({ summary });
  } catch (err) {
    console.error("POST /recommendations/ai-summary error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
