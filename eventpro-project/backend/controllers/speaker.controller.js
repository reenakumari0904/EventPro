import { query } from "../config/db.js";
import { sendSpeakerReminder } from "../utils/sendSpeakerReminder.js";

// POST /speakers
export async function createSpeaker(req, res) {
  try {
    const { name, email, topic, bio } = req.body;
    const result = await query(
      `INSERT INTO speakers (name, email, topic, bio) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, topic, bio]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /speakers error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /speakers
export async function getSpeakers(req, res) {
  try {
    const result = await query(`SELECT * FROM speakers ORDER BY name ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function checkSpeakerAvailability(req, res) {
  try {
    const { id } = req.params;
    const { start_time, end_time } = req.query;
    if (!start_time || !end_time) {
      return res.status(400).json({ error: "start_time and end_time are required." });
    }

    const result = await query(
      `SELECT s.session_id, s.title, s.start_time, s.end_time
       FROM sessions s
       WHERE s.speaker_id = $1
         AND s.start_time < $3
         AND s.end_time > $2`,
      [id, start_time, end_time]
    );

    res.json({
      available: result.rows.length === 0,
      conflicting_sessions: result.rows,
    });
  } catch (err) {
    console.error("GET /speakers/:id/availability error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// POST /speakers/ai-suggest — real AI speaker matching. Unlike
// checkSpeakerAvailability above (which only tells you if ONE named
// speaker is free), this looks at your ENTIRE roster, filters to who's
// actually available for the time slot, and asks Gemini to pick whose
// expertise best matches the session's topic — the way an event
// coordinator would match a speaker to a talk, not just check a calendar.
export async function aiSuggestSpeaker(req, res) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is not set in backend/.env. Get a free key at https://aistudio.google.com/apikey",
      });
    }

    const { title, track, topic_needed, start_time, end_time } = req.body;
    if (!start_time || !end_time) {
      return res.status(400).json({ error: "start_time and end_time are required." });
    }

    // Same "genuinely available" filter used by speaker scheduling —
    // the AI only ever picks from speakers who are actually free, it
    // never gets to double-book someone.
    const availableSpeakers = await query(
      `SELECT sp.speaker_id, sp.name, sp.topic, sp.bio
       FROM speakers sp
       WHERE sp.speaker_id NOT IN (
         SELECT s.speaker_id FROM sessions s
         WHERE s.speaker_id IS NOT NULL AND s.start_time < $2 AND s.end_time > $1
       )`,
      [start_time, end_time]
    );

    if (availableSpeakers.rows.length === 0) {
      return res.json({ recommendation: null, reasoning: "No speaker is available for this time slot.", options_considered: [] });
    }

    const prompt =
      "You are helping an event coordinator pick the best speaker for a session, based on how well " +
      "their expertise/topic matches what the session needs. Choose the single best speaker from the " +
      "list below. If none of them are a strong match, still pick the closest one but say so honestly " +
      'in the reasoning. Respond with ONLY valid JSON, no markdown, in this exact shape: ' +
      '{"speaker_id": <number>, "reasoning": "<1-2 sentence explanation>"}\n\n' +
      `Session: "${title || "Untitled session"}"` +
      (track ? `, track: ${track}` : "") +
      (topic_needed ? `, topic needed: ${topic_needed}` : "") +
      `\n\nAvailable speakers:\n${JSON.stringify(availableSpeakers.rows, null, 2)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

    const chosenSpeaker = availableSpeakers.rows.find((s) => s.speaker_id === parsed.speaker_id) || null;

    res.json({
      recommendation: chosenSpeaker,
      reasoning: parsed.reasoning || "",
      options_considered: availableSpeakers.rows,
    });
  } catch (err) {
    console.error("POST /speakers/ai-suggest error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
// PUT /speakers/:id
export async function updateSpeaker(req, res) {
  try {
    const { id } = req.params;
    const { name, email, topic, bio } = req.body;
    const result = await query(
      `UPDATE speakers SET name = $1, email = $2, topic = $3, bio = $4 WHERE speaker_id = $5 RETURNING *`,
      [name, email, topic, bio, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Speaker not found." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /speakers/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// DELETE /speakers/:id
export async function deleteSpeaker(req, res) {
  try {
    const { id } = req.params;
    const inUse = await query(`SELECT session_id FROM sessions WHERE speaker_id = $1 LIMIT 1`, [id]);
    if (inUse.rows.length > 0) {
      return res.status(409).json({ error: "Can't delete a speaker who has sessions assigned." });
    }
    const result = await query(`DELETE FROM speakers WHERE speaker_id = $1 RETURNING speaker_id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Speaker not found." });
    res.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /speakers/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// Simple keyword-overlap score between a session's title/track and a
// speaker's topic/bio — used as the rule-based fallback when no Gemini
// key is configured, and to break ties deterministically.
function topicMatchScore(session, speaker) {
  const haystack = `${speaker.topic || ""} ${speaker.bio || ""}`.toLowerCase();
  const needle = `${session.title || ""} ${session.track || ""}`.toLowerCase();
  const words = needle.split(/\W+/).filter((w) => w.length > 3);
  if (words.length === 0) return 0;
  return words.reduce((score, w) => score + (haystack.includes(w) ? 1 : 0), 0);
}

// POST /speakers/auto-schedule — the core of "Implement Speaker Scheduling".
// Finds every session that doesn't have a speaker yet, and for each one
// (in start-time order, so earlier sessions get first pick of who's free):
//   1. filters the roster down to speakers with no time conflict — taking
//      into account assignments this same run just made, so two sessions
//      in this batch never get double-booked with the same speaker;
//   2. picks the best match — Gemini reasoning if GEMINI_API_KEY is set,
//      otherwise a keyword-overlap fallback so the feature still works
//      without an API key;
//   3. saves the assignment, emails the speaker, and logs the action so
//      it shows up in the scheduling history/dashboard.
export async function autoScheduleSpeakers(req, res) {
  try {
    const unscheduled = await query(
      `SELECT s.session_id, s.title, s.track, s.start_time, s.end_time, v.name AS venue_name
       FROM sessions s
       LEFT JOIN venues v ON v.venue_id = s.venue_id
       WHERE s.speaker_id IS NULL
       ORDER BY s.start_time ASC`
    );

    if (unscheduled.rows.length === 0) {
      return res.json({ assigned: [], skipped: [], message: "Every session already has a speaker assigned." });
    }

    const allSpeakers = await query(`SELECT speaker_id, name, email, topic, bio FROM speakers`);
    const existingBookings = await query(
      `SELECT speaker_id, start_time, end_time FROM sessions WHERE speaker_id IS NOT NULL`
    );

    // Mutable in-memory booking list — grows as we assign speakers within this run.
    const bookings = existingBookings.rows.map((b) => ({ ...b }));
    const overlaps = (aStart, aEnd, bStart, bEnd) => new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);

    const useAi = Boolean(process.env.GEMINI_API_KEY);
    const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

    const assigned = [];
    const skipped = [];

    for (const session of unscheduled.rows) {
      const freeSpeakers = allSpeakers.rows.filter(
        (sp) => !bookings.some((b) => b.speaker_id === sp.speaker_id && overlaps(session.start_time, session.end_time, b.start_time, b.end_time))
      );

      if (freeSpeakers.length === 0) {
        skipped.push({ session_id: session.session_id, title: session.title, reason: "No speaker available for this time slot." });
        continue;
      }

      let chosen = null;
      let reasoning = "";

      if (useAi) {
        try {
          const prompt =
            "You are helping an event coordinator pick the best speaker for a session, based on how well " +
            "their expertise/topic matches what the session needs. Choose the single best speaker from the " +
            "list below. If none of them are a strong match, still pick the closest one but say so honestly " +
            'in the reasoning. Respond with ONLY valid JSON, no markdown, in this exact shape: ' +
            '{"speaker_id": <number>, "reasoning": "<1-2 sentence explanation>"}\n\n' +
            `Session: "${session.title}"` + (session.track ? `, track: ${session.track}` : "") +
            `\n\nAvailable speakers:\n${JSON.stringify(freeSpeakers, null, 2)}`;

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
          );
          if (response.ok) {
            const data = await response.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            const parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
            chosen = freeSpeakers.find((sp) => sp.speaker_id === parsed.speaker_id) || null;
            reasoning = parsed.reasoning || "";
          }
        } catch (aiErr) {
          console.warn(`AI scheduling fell back to rule-based for session ${session.session_id}:`, aiErr.message);
        }
      }

      if (!chosen) {
        // Rule-based fallback: best topic-match score, tie-broken by whoever has the lightest workload so far.
        const workload = (id) => bookings.filter((b) => b.speaker_id === id).length;
        chosen = [...freeSpeakers].sort((a, b) => {
          const scoreDiff = topicMatchScore(session, b) - topicMatchScore(session, a);
          return scoreDiff !== 0 ? scoreDiff : workload(a.speaker_id) - workload(b.speaker_id);
        })[0];
        reasoning = reasoning || "Rule-based match on topic keywords and current workload (no GEMINI_API_KEY configured).";
      }

      await query(`UPDATE sessions SET speaker_id = $1 WHERE session_id = $2`, [chosen.speaker_id, session.session_id]);
      bookings.push({ speaker_id: chosen.speaker_id, start_time: session.start_time, end_time: session.end_time });

      let reminderResult = { sent: false };
      if (chosen.email) {
        reminderResult = await sendSpeakerReminder({
          to: chosen.email,
          speakerName: chosen.name,
          sessionTitle: session.title,
          venueName: session.venue_name,
          startTime: session.start_time,
          endTime: session.end_time,
        });
      }

      await query(
        `INSERT INTO speaker_schedule_log (session_id, session_title, speaker_id, action, new_start_time, new_end_time, reasoning, notified)
         VALUES ($1, $2, $3, 'auto_assign', $4, $5, $6, $7)`,
        [session.session_id, session.title, chosen.speaker_id, session.start_time, session.end_time, reasoning, reminderResult.sent]
      );

      assigned.push({
        session_id: session.session_id,
        title: session.title,
        speaker_id: chosen.speaker_id,
        speaker_name: chosen.name,
        reasoning,
        notified: reminderResult.sent,
      });
    }

    res.json({ assigned, skipped, used_ai: useAi });
  } catch (err) {
    console.error("POST /speakers/auto-schedule error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /speakers/scheduling-analytics — powers the Speaker Scheduling dashboard.
export async function getSpeakerSchedulingAnalytics(req, res) {
  try {
    const coverage = await query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE speaker_id IS NOT NULL) AS with_speaker
       FROM sessions`
    );
    const total = parseInt(coverage.rows[0].total, 10);
    const withSpeaker = parseInt(coverage.rows[0].with_speaker, 10);

    const workload = await query(
      `SELECT sp.speaker_id, sp.name, COUNT(s.session_id) AS session_count
       FROM speakers sp
       LEFT JOIN sessions s ON s.speaker_id = sp.speaker_id
       GROUP BY sp.speaker_id, sp.name
       ORDER BY session_count DESC`
    );

    const upcoming = await query(
      `SELECT s.session_id, s.title, s.start_time, s.end_time, sp.name AS speaker_name, v.name AS venue_name
       FROM sessions s
       LEFT JOIN speakers sp ON sp.speaker_id = s.speaker_id
       LEFT JOIN venues v ON v.venue_id = s.venue_id
       WHERE s.start_time > NOW()
       ORDER BY s.start_time ASC
       LIMIT 8`
    );

    const changeLog = await query(
      `SELECT sl.log_id, sl.session_title, sl.action, sl.previous_start_time, sl.new_start_time,
              sl.new_end_time, sl.reasoning, sl.notified, sl.created_at, sp.name AS speaker_name
       FROM speaker_schedule_log sl
       LEFT JOIN speakers sp ON sp.speaker_id = sl.speaker_id
       ORDER BY sl.created_at DESC
       LIMIT 15`
    );

    res.json({
      total_sessions: total,
      sessions_with_speaker: withSpeaker,
      sessions_without_speaker: total - withSpeaker,
      coverage_pct: total > 0 ? Math.round((withSpeaker / total) * 100) : 0,
      speaker_workload: workload.rows,
      upcoming_schedule: upcoming.rows,
      change_log: changeLog.rows,
    });
  } catch (err) {
    console.error("GET /speakers/scheduling-analytics error:", err.message);
    res.status(500).json({ error: err.message });
  }
}