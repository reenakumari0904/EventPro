import { query } from "../config/db.js";
export async function computeOverview() {
  const regTotals = await query(`SELECT COUNT(*) AS total FROM registrations`);
  const regCheckedIn = await query(`SELECT COUNT(*) AS count FROM checkins WHERE checkin_time IS NOT NULL`);
  const total = parseInt(regTotals.rows[0].total, 10);
  const checkedIn = parseInt(regCheckedIn.rows[0].count, 10);
  const checkinRate = total > 0 ? Math.round((checkedIn / total) * 100) : null;

  const sessionCoverage = await query(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE speaker_id IS NOT NULL) AS with_speaker
     FROM sessions`
  );
  const sessionTotal = parseInt(sessionCoverage.rows[0].total, 10);
  const withSpeaker = parseInt(sessionCoverage.rows[0].with_speaker, 10);
  const schedulingCoveragePct = sessionTotal > 0 ? Math.round((withSpeaker / sessionTotal) * 100) : null;

  // ----- Session performance -----
  const avgRatingRow = await query(`SELECT ROUND(AVG(session_rating), 2) AS avg FROM session_feedback`);
  const attendanceRow = await query(
    `SELECT ROUND(AVG(CASE WHEN s.expected_attendees > 0 THEN (sub.actual::decimal / s.expected_attendees) * 100 END)) AS avg_rate
     FROM sessions s
     JOIN (SELECT session_id, COUNT(*) AS actual FROM session_attendance GROUP BY session_id) sub ON sub.session_id = s.session_id`
  );

  // ----- Sponsorship -----
  const sponsorFinancials = await query(`SELECT COALESCE(SUM(contract_amount), 0) AS total_contracted FROM sponsors`);
  const sponsorPaid = await query(`SELECT COALESCE(SUM(amount), 0) AS total_paid FROM sponsor_payments`);
  const sponsorAtRisk = await query(
    `SELECT COUNT(DISTINCT sponsor_id) AS count FROM sponsor_deliverables
     WHERE status = 'at_risk' OR (status = 'pending' AND due_date < CURRENT_DATE)`
  );
  const sponsorCount = await query(`SELECT COUNT(*) AS count FROM sponsors`);
  const sponsorEngagementTotals = await query(
    `SELECT COALESCE(SUM(metric_value) FILTER (WHERE metric_type = 'lead'), 0) AS leads,
            COALESCE(SUM(metric_value) FILTER (WHERE metric_type = 'conversion'), 0) AS conversions
     FROM sponsor_engagement`
  );
  const sponsorLeads = parseInt(sponsorEngagementTotals.rows[0].leads, 10);
  const sponsorConversions = parseInt(sponsorEngagementTotals.rows[0].conversions, 10);
  const sponsorRoiPct = sponsorLeads > 0 ? Math.round((sponsorConversions / sponsorLeads) * 100) : null;

  
  const venueUtilization = await query(
    `SELECT COUNT(*) AS total_venues,
            COUNT(*) FILTER (WHERE venue_id IN (SELECT DISTINCT venue_id FROM sessions WHERE venue_id IS NOT NULL)) AS venues_in_use
     FROM venues`
  );
  const venueOccupancy = await query(
    `SELECT ROUND(AVG(CASE WHEN v.capacity > 0 THEN (sub.actual::decimal / v.capacity) * 100 END)) AS avg_occupancy_pct
     FROM venues v
     JOIN sessions s ON s.venue_id = v.venue_id
     JOIN (SELECT session_id, COUNT(*) AS actual FROM session_attendance GROUP BY session_id) sub ON sub.session_id = s.session_id`
  );
  const totalVenues = parseInt(venueUtilization.rows[0].total_venues, 10);
  const venuesInUse = parseInt(venueUtilization.rows[0].venues_in_use, 10);

  // ----- Speaker performance -----
  const speakerParticipation = await query(
    `SELECT COUNT(*) AS total_speakers, COUNT(*) FILTER (WHERE session_count > 0) AS speakers_participating
     FROM (SELECT sp.speaker_id, COUNT(s.session_id) AS session_count FROM speakers sp LEFT JOIN sessions s ON s.speaker_id = sp.speaker_id GROUP BY sp.speaker_id) sub`
  );
  const completedSessions = await query(`SELECT COUNT(*) AS count FROM sessions WHERE end_time <= NOW()`);
  const avgSpeakerRatingRow = await query(`SELECT ROUND(AVG(speaker_rating), 2) AS avg FROM session_feedback`);
  const totalSpeakers = parseInt(speakerParticipation.rows[0].total_speakers, 10);
  const speakersParticipating = parseInt(speakerParticipation.rows[0].speakers_participating, 10);

  // ----- Incidents -----
  const openIncidents = await query(
    `SELECT severity, COUNT(*) AS count FROM incidents WHERE status NOT IN ('resolved', 'closed') GROUP BY severity`
  );
  const criticalOpen = parseInt(openIncidents.rows.find((r) => r.severity === "critical")?.count || 0, 10);
  const highOpen = parseInt(openIncidents.rows.find((r) => r.severity === "high")?.count || 0, 10);

  // ----- Alerts -----
  const unackAlerts = await query(
    `SELECT alert_level, COUNT(*) AS count FROM operational_alerts WHERE acknowledged = false GROUP BY alert_level`
  );

  let score = 100;
  const deductions = [];
  if (checkinRate !== null && checkinRate < 50) { score -= 10; deductions.push("Check-in rate below 50%"); }
  if (schedulingCoveragePct !== null && schedulingCoveragePct < 80) { score -= 10; deductions.push("Speaker scheduling coverage below 80%"); }
  if (criticalOpen > 0) { score -= 20 * Math.min(criticalOpen, 2); deductions.push(`${criticalOpen} open critical incident(s)`); }
  if (highOpen > 0) { score -= 8 * Math.min(highOpen, 3); deductions.push(`${highOpen} open high-severity incident(s)`); }
  if (parseInt(sponsorAtRisk.rows[0].count, 10) > 0) { score -= 10; deductions.push(`${sponsorAtRisk.rows[0].count} sponsor(s) with at-risk deliverables`); }
  const criticalAlerts = parseInt(unackAlerts.rows.find((r) => r.alert_level === "critical")?.count || 0, 10);
  if (criticalAlerts > 0) { score -= 15; deductions.push(`${criticalAlerts} unacknowledged critical alert(s)`); }
  score = Math.max(0, Math.min(100, score));

  return {
    event_health_score: score,
    score_deductions: deductions,
    registration: { total, checked_in: checkedIn, checkin_rate_pct: checkinRate },
    scheduling: { total_sessions: sessionTotal, sessions_with_speaker: withSpeaker, coverage_pct: schedulingCoveragePct },
    session_performance: { avg_rating: avgRatingRow.rows[0].avg, avg_attendance_rate_pct: attendanceRow.rows[0].avg_rate },
    sponsorship: {
      sponsor_count: parseInt(sponsorCount.rows[0].count, 10),
      total_contracted: parseFloat(sponsorFinancials.rows[0].total_contracted),
      total_paid: parseFloat(sponsorPaid.rows[0].total_paid),
      at_risk_sponsors: parseInt(sponsorAtRisk.rows[0].count, 10),
      roi_pct: sponsorRoiPct,
    },
    venue_performance: {
      total_venues: totalVenues,
      venues_in_use: venuesInUse,
      utilization_pct: totalVenues > 0 ? Math.round((venuesInUse / totalVenues) * 100) : null,
      avg_hall_occupancy_pct: venueOccupancy.rows[0].avg_occupancy_pct,
    },
    speaker_performance: {
      sessions_conducted: parseInt(completedSessions.rows[0].count, 10),
      total_speakers: totalSpeakers,
      speakers_participating: speakersParticipating,
      participation_pct: totalSpeakers > 0 ? Math.round((speakersParticipating / totalSpeakers) * 100) : null,
      avg_session_rating: avgRatingRow.rows[0].avg,
      avg_audience_engagement_rating: avgSpeakerRatingRow.rows[0].avg,
    },
    incidents: { open_by_severity: openIncidents.rows, critical_open: criticalOpen, high_open: highOpen },
    alerts: { unacknowledged_by_level: unackAlerts.rows },
  };
}

export async function computeInsights() {
  const insights = [];
  const capacityTrend = await query(
    `SELECT v.venue_id, v.name AS venue_name, v.capacity,
            COUNT(sa.attendance_id) AS current_attendance,
            COUNT(sa.attendance_id) FILTER (WHERE sa.checked_in_at > NOW() - INTERVAL '10 minutes') AS recent_checkins,
            s.session_id, s.title AS current_session
     FROM venues v
     JOIN sessions s ON s.venue_id = v.venue_id AND s.start_time <= NOW() AND s.end_time >= NOW()
     LEFT JOIN session_attendance sa ON sa.session_id = s.session_id
     GROUP BY v.venue_id, v.name, v.capacity, s.session_id, s.title
     HAVING v.capacity > 0`
  );
  for (const c of capacityTrend.rows) {
    const pct = Math.round((c.current_attendance / c.capacity) * 100);
    if (pct >= 70) {
      const nextSession = await query(
        `SELECT title, start_time FROM sessions WHERE venue_id = $1 AND start_time > NOW() ORDER BY start_time ASC LIMIT 1`,
        [c.venue_id]
      );
      const minutesToNext = nextSession.rows[0]
        ? Math.round((new Date(nextSession.rows[0].start_time) - new Date()) / 60000)
        : null;
      insights.push({
        type: "capacity_trend",
        severity: pct >= 90 ? "high" : "medium",
        title: `${c.venue_name} trending toward capacity`,
        message:
          `${c.venue_name} is at ${pct}% capacity during "${c.current_session}", with ${c.recent_checkins} check-ins in the last 10 minutes.` +
          (minutesToNext !== null && minutesToNext <= 20
            ? ` "${nextSession.rows[0].title}" starts in ${minutesToNext} minutes — consider deploying additional check-in staff or opening an alternate entry point.`
            : " Consider monitoring closely as the next session approaches."),
      });
    }
  }
  const registrationTrend = await query(
    `SELECT COUNT(*) AS recent FROM registrations WHERE registration_date > NOW() - INTERVAL '1 hour'`
  );
  const recentRegs = parseInt(registrationTrend.rows[0].recent, 10);
  if (recentRegs >= 10) {
    insights.push({
      type: "registration_velocity",
      severity: "informational",
      title: "Registration activity increasing",
      message: `${recentRegs} new registrations in the last hour — a noticeably active period. Confirm check-in desks are adequately staffed.`,
    });
  }

  // Risk: unscheduled sessions close to their start time.
  const nearTermUnscheduled = await query(
    `SELECT session_id, title, start_time FROM sessions
     WHERE speaker_id IS NULL AND start_time BETWEEN NOW() AND NOW() + INTERVAL '2 hours'`
  );
  for (const s of nearTermUnscheduled.rows) {
    const minutesAway = Math.round((new Date(s.start_time) - new Date()) / 60000);
    insights.push({
      type: "scheduling_risk",
      severity: "high",
      title: `Unassigned speaker: ${s.title}`,
      message: `"${s.title}" starts in ${minutesAway} minutes with no speaker assigned. Run Auto-Schedule or assign one manually now.`,
    });
  }

  // Risk: sponsor deliverable due within the event window, still pending.
  const sponsorRisk = await query(
    `SELECT d.description, s.name AS sponsor_name, d.due_date
     FROM sponsor_deliverables d JOIN sponsors s ON s.sponsor_id = d.sponsor_id
     WHERE d.status = 'pending' AND d.due_date <= CURRENT_DATE`
  );
  for (const d of sponsorRisk.rows) {
    insights.push({
      type: "sponsor_risk",
      severity: "medium",
      title: `Sponsor deliverable due: ${d.sponsor_name}`,
      message: `"${d.description}" for ${d.sponsor_name} is due and still pending — resolve before it becomes a relationship issue.`,
    });
  }

  const severityRank = { high: 0, medium: 1, informational: 2 };
  insights.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  return insights;
}

export async function getIntelligenceOverview(req, res) {
  try {
    const overview = await computeOverview();
    res.json(overview);
  } catch (err) {
    console.error("GET /intelligence/overview error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

export async function getIntelligenceInsights(req, res) {
  try {
    const insights = await computeInsights();
    res.json({ insights, count: insights.length });
  } catch (err) {
    console.error("GET /intelligence/insights error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
export async function getAiExecutiveBriefing(req, res) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "GEMINI_API_KEY is not set in backend/.env. Get a free key at https://aistudio.google.com/apikey" });
    }

    const [overview, insights] = await Promise.all([computeOverview(), computeInsights()]);

    const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const prompt =
      "You are briefing an event executive who has 15 seconds to read this. Given the live event health data " +
      "and current insights below, write a short executive briefing (3-5 sentences): overall state first, then " +
      "the 1-2 things that most need attention right now, in plain language — no jargon, no restating every number.\n\n" +
      `Overview:\n${JSON.stringify(overview, null, 2)}\n\nInsights:\n${JSON.stringify(insights, null, 2)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return res.status(502).json({ error: errBody?.error?.message || "Gemini API request failed." });
    }
    const data = await response.json();
    const briefing = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    res.json({ briefing });
  } catch (err) {
    console.error("POST /intelligence/ai-briefing error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
