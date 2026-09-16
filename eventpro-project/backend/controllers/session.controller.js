 import { query } from "../config/db.js";
import { sendSpeakerReminder, sendScheduleUpdateNotice } from "../utils/sendSpeakerReminder.js";

export async function createSession(req, res) {
  try {
    const { event_id, venue_id, speaker_id, title, track, start_time, end_time, expected_attendees } = req.body;

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: "title, start_time and end_time are required." });
    }
    if (new Date(end_time) <= new Date(start_time)) {
      return res.status(400).json({ error: "End time must be after start time. If the session runs past midnight, pick the following day's date for the end time." });
    }

    if (venue_id) {
      const venueConflict = await query(
        `SELECT session_id, title FROM sessions
         WHERE venue_id = $1 AND start_time < $3 AND end_time > $2`,
        [venue_id, start_time, end_time]
      );
      if (venueConflict.rows.length > 0) {
        return res.status(409).json({
          error: `Venue is already booked for "${venueConflict.rows[0].title}" during this time.`,
        });
      }
    }

    if (speaker_id) {
      const speakerConflict = await query(
        `SELECT session_id, title FROM sessions
         WHERE speaker_id = $1 AND start_time < $3 AND end_time > $2`,
        [speaker_id, start_time, end_time]
      );
      if (speakerConflict.rows.length > 0) {
        return res.status(409).json({
          error: `Speaker is already booked for "${speakerConflict.rows[0].title}" during this time.`,
        });
      }
    }

    const result = await query(
      `INSERT INTO sessions (event_id, venue_id, speaker_id, title, track, start_time, end_time, expected_attendees)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [event_id || null, venue_id || null, speaker_id || null, title, track || null, start_time, end_time, expected_attendees || null]
    );
    const session = result.rows[0];

    let reminderResult = { sent: false, reason: "no_speaker_assigned" };
    if (speaker_id) {
      const speakerRow = await query(`SELECT name, email FROM speakers WHERE speaker_id = $1`, [speaker_id]);
      const speaker = speakerRow.rows[0];
      let venueName = null;
      if (venue_id) {
        const venueRow = await query(`SELECT name FROM venues WHERE venue_id = $1`, [venue_id]);
        venueName = venueRow.rows[0]?.name;
      }
      if (speaker?.email) {
        reminderResult = await sendSpeakerReminder({
          to: speaker.email,
          speakerName: speaker.name,
          sessionTitle: title,
          venueName,
          startTime: start_time,
          endTime: end_time,
        });
      }
    }

    res.status(201).json({ ...session, reminder_sent: reminderResult.sent });
  } catch (err) {
    console.error("POST /sessions error:", err.message);
    res.status(500).json({ error: err.message });
  }
}


// Core reschedule/reassign logic, extracted so the HTTP handler below and
// the Agent Orchestration workflows (services/workflows/*) can both move a
// session without depending on Express req/res.
export async function rescheduleSessionRecord(id, { start_time, end_time, venue_id, speaker_id, reasoning, actor } = {}) {
  const existingRow = await query(`SELECT * FROM sessions WHERE session_id = $1`, [id]);
  const existing = existingRow.rows[0];
  if (!existing) {
    const err = new Error("Session not found.");
    err.status = 404;
    throw err;
  }

  const newStart = start_time || existing.start_time;
  const newEnd = end_time || existing.end_time;
  if (new Date(newEnd) <= new Date(newStart)) {
    const err = new Error("End time must be after start time. If the session runs past midnight, pick the following day's date for the end time.");
    err.status = 400;
    throw err;
  }
  const newVenueId = venue_id !== undefined ? venue_id || null : existing.venue_id;
  const newSpeakerId = speaker_id !== undefined ? speaker_id || null : existing.speaker_id;

  if (newVenueId) {
    const venueConflict = await query(
      `SELECT session_id, title FROM sessions
       WHERE venue_id = $1 AND session_id != $2 AND start_time < $4 AND end_time > $3`,
      [newVenueId, id, newStart, newEnd]
    );
    if (venueConflict.rows.length > 0) {
      const err = new Error(`Venue is already booked for "${venueConflict.rows[0].title}" during this time.`);
      err.status = 409;
      throw err;
    }
  }
  if (newSpeakerId) {
    const speakerConflict = await query(
      `SELECT session_id, title FROM sessions
       WHERE speaker_id = $1 AND session_id != $2 AND start_time < $4 AND end_time > $3`,
      [newSpeakerId, id, newStart, newEnd]
    );
    if (speakerConflict.rows.length > 0) {
      const err = new Error(`Speaker is already booked for "${speakerConflict.rows[0].title}" during this time.`);
      err.status = 409;
      throw err;
    }
  }

  const updated = await query(
    `UPDATE sessions SET start_time = $1, end_time = $2, venue_id = $3, speaker_id = $4 WHERE session_id = $5 RETURNING *`,
    [newStart, newEnd, newVenueId, newSpeakerId, id]
  );
  const session = updated.rows[0];

  let notified = false;
  const action = existing.speaker_id !== newSpeakerId ? "reassign" : "reschedule";
  if (newSpeakerId) {
    const speakerRow = await query(`SELECT name, email FROM speakers WHERE speaker_id = $1`, [newSpeakerId]);
    const speaker = speakerRow.rows[0];
    let venueName = null;
    if (newVenueId) {
      const venueRow = await query(`SELECT name FROM venues WHERE venue_id = $1`, [newVenueId]);
      venueName = venueRow.rows[0]?.name;
    }
    if (speaker?.email) {
      const result = await sendScheduleUpdateNotice({
        to: speaker.email,
        speakerName: speaker.name,
        sessionTitle: session.title,
        venueName,
        previousStartTime: existing.start_time,
        newStartTime: newStart,
        newEndTime: newEnd,
      });
      notified = result.sent;
    }
  }

  await query(
    `INSERT INTO speaker_schedule_log
       (session_id, session_title, speaker_id, action, previous_start_time, previous_end_time, new_start_time, new_end_time, reasoning, notified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, session.title, newSpeakerId, action, existing.start_time, existing.end_time, newStart, newEnd, reasoning || "Manually rescheduled by organizer.", notified]
  );

  return { ...session, notified };
}

export async function rescheduleSession(req, res) {
  try {
    const { id } = req.params;
    const result = await rescheduleSessionRecord(id, req.body);
    res.json(result);
  } catch (err) {
    console.error("PUT /sessions/:id/reschedule error:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
}
export async function recordSessionAttendance(req, res) {
  try {
    const { id } = req.params;
    const { registration_id } = req.body;
    if (!registration_id) return res.status(400).json({ error: "registration_id is required." });

    await query(
      `INSERT INTO session_attendance (session_id, registration_id) VALUES ($1, $2)
       ON CONFLICT (session_id, registration_id) DO NOTHING`,
      [id, registration_id]
    );
    const count = await query(`SELECT COUNT(*) FROM session_attendance WHERE session_id = $1`, [id]);
    res.status(201).json({ recorded: true, session_attendee_count: parseInt(count.rows[0].count, 10) });
  } catch (err) {
    console.error("POST /sessions/:id/attendance error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
export async function submitSessionFeedback(req, res) {
  try {
    const { id } = req.params;
    const { registration_id, session_rating, speaker_rating, comments } = req.body;
    if (!session_rating) return res.status(400).json({ error: "session_rating is required." });

    const result = await query(
      `INSERT INTO session_feedback (session_id, registration_id, session_rating, speaker_rating, comments)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, registration_id || null, session_rating, speaker_rating || null, comments || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /sessions/:id/feedback error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
export async function getSessions(req, res) {
  try {
    const result = await query(
      `SELECT s.session_id, s.title, s.track, s.start_time, s.end_time, s.expected_attendees,
              v.name AS venue_name, v.capacity AS venue_capacity,
              sp.name AS speaker_name, sp.topic AS speaker_topic
       FROM sessions s
       LEFT JOIN venues v ON v.venue_id = s.venue_id
       LEFT JOIN speakers sp ON sp.speaker_id = s.speaker_id
       ORDER BY s.start_time ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /sessions/analytics — session-level breakdowns for the dashboard.
export async function getSessionAnalytics(req, res) {
  try {
    const totalSessions = await query(`SELECT COUNT(*) FROM sessions`);
    const upcoming = await query(`SELECT COUNT(*) FROM sessions WHERE start_time > NOW()`);
    const completed = await query(`SELECT COUNT(*) FROM sessions WHERE end_time <= NOW()`);

    const byTrack = await query(
      `SELECT COALESCE(track, 'Unassigned') AS track, COUNT(*) AS count
       FROM sessions GROUP BY track ORDER BY count DESC`
    );
    const byVenue = await query(
      `SELECT v.name AS venue, COUNT(*) AS count
       FROM sessions s JOIN venues v ON v.venue_id = s.venue_id
       GROUP BY v.name ORDER BY count DESC`
    );
    const bySpeaker = await query(
      `SELECT sp.name AS speaker, COUNT(*) AS count
       FROM sessions s JOIN speakers sp ON sp.speaker_id = s.speaker_id
       GROUP BY sp.name ORDER BY count DESC`
    );

    // ----- Attendee participation -----
    // attendance_rate = actual attendees (session_attendance) vs expected_attendees.
    const participation = await query(
      `SELECT s.session_id, s.title, s.expected_attendees, v.capacity AS venue_capacity,
              COUNT(sa.attendance_id) AS actual_attendees,
              CASE WHEN s.expected_attendees > 0
                   THEN ROUND((COUNT(sa.attendance_id)::decimal / s.expected_attendees) * 100)
                   ELSE NULL END AS attendance_rate_pct,
              CASE WHEN v.capacity > 0
                   THEN ROUND((COUNT(sa.attendance_id)::decimal / v.capacity) * 100)
                   ELSE NULL END AS room_occupancy_pct
       FROM sessions s
       LEFT JOIN venues v ON v.venue_id = s.venue_id
       LEFT JOIN session_attendance sa ON sa.session_id = s.session_id
       GROUP BY s.session_id, s.title, s.expected_attendees, v.capacity
       ORDER BY actual_attendees DESC`
    );

    const mostPopular = participation.rows.slice(0, 5);

    // ----- Peak attendance times: attendance grouped by session start hour -----
    const peakAttendance = await query(
      `SELECT EXTRACT(HOUR FROM s.start_time)::int AS hour, COUNT(sa.attendance_id) AS attendee_count
       FROM sessions s
       LEFT JOIN session_attendance sa ON sa.session_id = s.session_id
       GROUP BY hour
       ORDER BY hour ASC`
    );

    // ----- Ratings: overall average session rating + per-speaker feedback score -----
    const avgSessionRating = await query(`SELECT ROUND(AVG(session_rating), 2) AS avg FROM session_feedback`);
    const speakerFeedback = await query(
      `SELECT sp.name AS speaker, ROUND(AVG(f.speaker_rating), 2) AS avg_speaker_rating, COUNT(f.feedback_id) AS feedback_count
       FROM session_feedback f
       JOIN sessions s ON s.session_id = f.session_id
       JOIN speakers sp ON sp.speaker_id = s.speaker_id
       GROUP BY sp.name
       ORDER BY avg_speaker_rating DESC`
    );

    // ----- Venue utilization (session-analytics view — room occupancy by venue) -----
    const venueOccupancy = await query(
      `SELECT v.name AS venue,
              ROUND(AVG(CASE WHEN v.capacity > 0 THEN (sub.actual_attendees::decimal / v.capacity) * 100 END)) AS avg_occupancy_pct
       FROM venues v
       JOIN sessions s ON s.venue_id = v.venue_id
       JOIN (SELECT session_id, COUNT(*) AS actual_attendees FROM session_attendance GROUP BY session_id) sub
         ON sub.session_id = s.session_id
       GROUP BY v.name
       ORDER BY avg_occupancy_pct DESC NULLS LAST`
    );

    res.json({
      total_sessions: parseInt(totalSessions.rows[0].count, 10),
      upcoming: parseInt(upcoming.rows[0].count, 10),
      completed: parseInt(completed.rows[0].count, 10),
      by_track: byTrack.rows,
      by_venue: byVenue.rows,
      by_speaker: bySpeaker.rows,
      session_participation: participation.rows,
      most_popular_sessions: mostPopular,
      peak_attendance_times: peakAttendance.rows,
      average_session_rating: avgSessionRating.rows[0].avg,
      speaker_feedback_scores: speakerFeedback.rows,
      venue_occupancy: venueOccupancy.rows,
    });
  } catch (err) {
    console.error("GET /sessions/analytics error:", err.message);
    res.status(500).json({ error: err.message });
  }
}