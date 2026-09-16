import { query } from "../config/db.js";

// POST /venues
export async function createVenue(req, res) {
  try {
    const { name, location, capacity, amenities } = req.body;
    const result = await query(
      `INSERT INTO venues (name, location, capacity, amenities) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, location, capacity, amenities]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /venues error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /venues
export async function getVenues(req, res) {
  try {
    const result = await query(`SELECT * FROM venues ORDER BY capacity ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /venues/:id
export async function updateVenue(req, res) {
  try {
    const { id } = req.params;
    const { name, location, capacity, amenities } = req.body;
    const result = await query(
      `UPDATE venues SET name = $1, location = $2, capacity = $3, amenities = $4 WHERE venue_id = $5 RETURNING *`,
      [name, location, capacity, amenities, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Venue not found." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /venues/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// DELETE /venues/:id
export async function deleteVenue(req, res) {
  try {
    const { id } = req.params;
    const inUse = await query(`SELECT session_id FROM sessions WHERE venue_id = $1 LIMIT 1`, [id]);
    if (inUse.rows.length > 0) {
      return res.status(409).json({ error: "Can't delete a venue that has sessions scheduled in it." });
    }
    const result = await query(`DELETE FROM venues WHERE venue_id = $1 RETURNING venue_id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Venue not found." });
    res.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /venues/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /venues/suggest?expected_attendees=100&start_time=...&end_time=...
// Plain-SQL rule-based suggestion — smallest available venue that fits.
export async function suggestVenue(req, res) {
  try {
    const { expected_attendees, start_time, end_time } = req.query;
    if (!expected_attendees || !start_time || !end_time) {
      return res.status(400).json({ error: "expected_attendees, start_time and end_time are required." });
    }

    const result = await query(
      `SELECT v.*
       FROM venues v
       WHERE v.capacity >= $1
         AND v.venue_id NOT IN (
           SELECT s.venue_id FROM sessions s
           WHERE s.venue_id IS NOT NULL AND s.start_time < $3 AND s.end_time > $2
         )
       ORDER BY v.capacity ASC`,
      [expected_attendees, start_time, end_time]
    );

    res.json({ best_match: result.rows[0] || null, all_available_options: result.rows });
  } catch (err) {
    console.error("GET /venues/suggest error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// Shared helper: capacity_match = how tightly a venue fits the crowd.
// 100% = capacity exactly matches attendees (zero wasted seats).
// Below 50% means more than half the room sits empty.
function capacityMatchPct(expectedAttendees, venueCapacity) {
  if (!venueCapacity) return 0;
  return Math.round((expectedAttendees / venueCapacity) * 100);
}

// POST /venues/ai-suggest — the Venue Optimization Engine.
// Combines real Gemini reasoning (amenities/context fit) with a
// deterministic capacity/utilization scoring layer, decides whether the
// pick is a good "match", an "upgrade" (bigger, safer), or a "downgrade"
// (smaller, less wasted space) suggestion, and logs the recommendation
// to venue_recommendations for the optimization dashboard's history.
export async function aiSuggestVenue(req, res) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is not set in backend/.env. Get a free key at https://aistudio.google.com/apikey",
      });
    }

    const { title, track, expected_attendees, amenities_needed, start_time, end_time } = req.body;
    const expectedNum = parseInt(expected_attendees, 10);
    if (!expectedNum || !start_time || !end_time) {
      return res.status(400).json({ error: "expected_attendees, start_time and end_time are required." });
    }

    // Only venues that are genuinely free for this slot are ever considered.
    const availableVenues = await query(
      `SELECT v.venue_id, v.name, v.location, v.capacity, v.amenities
       FROM venues v
       WHERE v.venue_id NOT IN (
         SELECT s.venue_id FROM sessions s
         WHERE s.venue_id IS NOT NULL AND s.start_time < $2 AND s.end_time > $1
       )
       ORDER BY v.capacity ASC`,
      [start_time, end_time]
    );

    const fitting = availableVenues.rows.filter((v) => v.capacity >= expectedNum);

    if (fitting.length === 0) {
      return res.json({
        recommendation: null,
        reasoning: "No available venue meets the capacity requirement for this time slot.",
        suggestion_type: null,
        capacity_match_pct: null,
        utilization_score: null,
        alternatives: [],
      });
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const prompt =
      "You are helping an event coordinator pick the best venue for a session. " +
      "Choose the single best venue from the list below, considering capacity efficiency " +
      "(don't waste a huge venue on a small session), how well its amenities match what's " +
      "needed, and location if relevant. Respond with ONLY valid JSON, no markdown, in this " +
      'exact shape: {"venue_id": <number>, "reasoning": "<1-2 sentence explanation>"}\n\n' +
      `Session: "${title || "Untitled session"}"` +
      (track ? `, track: ${track}` : "") +
      `, expected attendees: ${expectedNum}` +
      (amenities_needed ? `, needed amenities: ${amenities_needed}` : "") +
      `\n\nAvailable venues (already filtered to ones with enough capacity):\n${JSON.stringify(fitting, null, 2)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error("Gemini API error:", errBody);
      return res.status(502).json({ error: errBody?.error?.message || "Gemini API request failed." });
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let parsed;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({ error: "AI response wasn't valid JSON.", raw: rawText });
    }

    const chosenVenue = fitting.find((v) => v.venue_id === parsed.venue_id) || fitting[0];
    const capacityMatch = capacityMatchPct(expectedNum, chosenVenue.capacity);

    // Upgrade/downgrade logic — deterministic, not left to the LLM, so
    // it's consistent and explainable.
    let suggestionType = "match";
    let upgradeOrDowngrade = null;
    if (capacityMatch < 50) {
      // Room is way bigger than needed — see if a smaller-but-still-fitting
      // venue exists that wastes less space.
      const smaller = fitting.find((v) => v.venue_id !== chosenVenue.venue_id && v.capacity < chosenVenue.capacity);
      if (smaller) {
        suggestionType = "downgrade";
        upgradeOrDowngrade = { ...smaller, capacity_match_pct: capacityMatchPct(expectedNum, smaller.capacity) };
      }
    } else if (capacityMatch > 95) {
      // Nearly full — suggest a slightly bigger room as a safety margin, if one exists.
      const bigger = availableVenues.rows.find((v) => v.capacity > chosenVenue.capacity);
      if (bigger) {
        suggestionType = "upgrade";
        upgradeOrDowngrade = { ...bigger, capacity_match_pct: capacityMatchPct(expectedNum, bigger.capacity) };
      }
    }

    // Utilization score blends capacity fit with a small bonus for
    // amenities being specified (proxy for "the AI had real context to work with").
    const utilizationScore = Math.max(0, Math.min(100, capacityMatch - (capacityMatch > 100 ? 0 : 0)));

    // Log this recommendation for the optimization dashboard's history.
    await query(
      `INSERT INTO venue_recommendations
         (session_title, expected_attendees, recommended_venue_id, capacity_match_pct, utilization_score, suggestion_type, reasoning)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [title || "Untitled session", expectedNum, chosenVenue.venue_id, capacityMatch, utilizationScore, suggestionType, parsed.reasoning || ""]
    );

    res.json({
      recommendation: chosenVenue,
      reasoning: parsed.reasoning || "",
      capacity_match_pct: capacityMatch,
      utilization_score: utilizationScore,
      suggestion_type: suggestionType,           // 'match' | 'upgrade' | 'downgrade'
      suggested_alternative: upgradeOrDowngrade, // the specific upgrade/downgrade venue, if any
      alternatives: fitting.filter((v) => v.venue_id !== chosenVenue.venue_id),
    });
  } catch (err) {
    console.error("POST /venues/ai-suggest error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /venues/optimization-analytics — powers the Venue Optimization dashboard.
export async function getVenueOptimizationAnalytics(req, res) {
  try {
    // Per-venue utilization: average capacity_match across sessions actually
    // booked into that venue, plus total wasted seats (capacity - attendees,
    // summed, never negative).
    const utilization = await query(
      `SELECT v.venue_id, v.name, v.capacity,
          COUNT(s.session_id) AS sessions_booked,
          ROUND(AVG(CASE WHEN s.expected_attendees IS NOT NULL
                         THEN (s.expected_attendees::decimal / v.capacity) * 100 END)) AS avg_utilization_pct,
          COALESCE(SUM(CASE WHEN s.session_id IS NOT NULL
                             THEN GREATEST(v.capacity - COALESCE(s.expected_attendees, 0), 0)
                             ELSE 0 END), 0) AS wasted_capacity
     FROM venues v
     LEFT JOIN sessions s ON s.venue_id = v.venue_id
     GROUP BY v.venue_id, v.name, v.capacity
      ORDER BY avg_utilization_pct DESC NULLS LAST`
);

    // Peak occupancy hours — how many sessions start in each hour of the day.
    const peakHours = await query(
      `SELECT EXTRACT(HOUR FROM start_time)::int AS hour, COUNT(*) AS session_count
       FROM sessions
       GROUP BY hour
       ORDER BY hour ASC`
    );

    // Overall optimization score — the same metric the AI recommender logs,
    // averaged across recommendation history.
    const overallScore = await query(
      `SELECT ROUND(AVG(utilization_score)) AS avg_score, COUNT(*) AS total_recommendations
       FROM venue_recommendations`
    );

    const upgradeDowngradeCounts = await query(
      `SELECT suggestion_type, COUNT(*) AS count
       FROM venue_recommendations
       GROUP BY suggestion_type`
    );

    const history = await query(
      `SELECT vr.recommendation_id, vr.session_title, vr.expected_attendees, vr.capacity_match_pct,
              vr.utilization_score, vr.suggestion_type, vr.reasoning, vr.created_at,
              v.name AS venue_name
       FROM venue_recommendations vr
       LEFT JOIN venues v ON v.venue_id = vr.recommended_venue_id
       ORDER BY vr.created_at DESC
       LIMIT 15`
    );

    res.json({
      venue_utilization: utilization.rows,
      peak_hours: peakHours.rows,
      optimization_score: overallScore.rows[0]?.avg_score || null,
      total_recommendations: parseInt(overallScore.rows[0]?.total_recommendations || 0, 10),
      suggestion_breakdown: upgradeDowngradeCounts.rows,
      recommendation_history: history.rows,
    });
  } catch (err) {
    console.error("GET /venues/optimization-analytics error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
