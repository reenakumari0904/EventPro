import { query } from "../config/db.js";

// GET /ai/insights — the ONLY place in this project that calls a real
// AI model. Everything else (venue optimization, speaker scheduling,
// the rule-based "AI Insights" cards) is plain SQL/JS logic.
//
// This pulls live numbers from the database, hands them to Google's
// free Gemini API as a prompt, and returns whatever natural-language
// summary the model writes — genuinely AI-generated, not templated.
export async function generateAiInsights(req, res) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is not set in backend/.env. Get a free key at https://aistudio.google.com/apikey",
      });
    }

    // Gather the same kind of real numbers the rest of the dashboard uses.
    const stats = await query(`
      SELECT
        (SELECT COUNT(*) FROM registrations) AS total_registrations,
        (SELECT COUNT(*) FROM checkins WHERE checkin_time IS NOT NULL) AS checked_in,
        (SELECT COUNT(*) FROM registrations WHERE status = 'Cancelled') AS cancelled,
        (SELECT COUNT(*) FROM registrations WHERE status = 'Waitlisted') AS waitlisted
    `);
    const byTicketType = await query(`SELECT ticket_type, COUNT(*) FROM registrations GROUP BY ticket_type`);
    const bySource = await query(`SELECT source, COUNT(*) FROM registrations GROUP BY source`);
    const sessionStats = await query(`
      SELECT
        (SELECT COUNT(*) FROM sessions) AS total_sessions,
        (SELECT COUNT(*) FROM sessions WHERE start_time > NOW()) AS upcoming_sessions
    `);

    const dataSummary = {
      registrations: stats.rows[0],
      by_ticket_type: byTicketType.rows,
      by_source: bySource.rows,
      sessions: sessionStats.rows[0],
    };

    const prompt =
      "You are analyzing real event registration data for an event organizer dashboard. " +
      "Based on this JSON data, write 3 to 4 short, specific, actionable insights " +
      "(1 sentence each, no fluff, no generic advice). If a number is zero or the data " +
      "is too sparse to say something meaningful, say so honestly instead of making " +
      "something up.\n\nData:\n" + JSON.stringify(dataSummary, null, 2);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error("Gemini API error:", errBody);
      return res.status(502).json({ error: errBody?.error?.message || "Gemini API request failed." });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No insights generated.";

    res.json({ insights_text: text, source_data: dataSummary });
  } catch (err) {
    console.error("GET /ai/insights error:", err.message);
    res.status(500).json({ error: err.message });
  }
}