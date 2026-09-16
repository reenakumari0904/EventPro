// ============================================================
// Workflow: High Crowd Detection
// ============================================================
// This is the milestone brief's opening "Example":
//   Hall capacity: 90%, registrations increasing rapidly, check-in queue
//   increasing, next session starting in 10 minutes → "High crowd density
//   is expected at Hall A. Consider deploying additional check-in staff
//   and opening an alternative entry point."
// ...generalized into "Scenario 4 – High Crowd": Registration/check-in
// data → Intelligence Engine → Capacity analysis → Risk detection →
// Operational alert → Recommended action.
//
// Unlike the other two scenario workflows, this one has no human-approval
// gate — it's a read/advise workflow (recommend, don't act), so there's
// nothing destructive for a human to approve.
//
// Trigger: POST /api/workflows/high-crowd  { venue_id }

import { query } from "../../config/db.js";
import { clearCache } from "../../utils/cache.js";
import { defineWorkflow } from "./engine.js";

const steps = [
  // ---- 1. Registration/Check-in Agent: pull live data ----
  {
    name: "registration-checkin-agent-pull-data",
    agent: "registration-checkin-agent",
    onError: "abort",
    run: async (ctx) => {
      const venueRow = await query(`SELECT * FROM venues WHERE venue_id = $1`, [ctx.venue_id]);
      const venue = venueRow.rows[0];
      if (!venue) throw new Error(`Venue ${ctx.venue_id} not found.`);

      const currentSessionRow = await query(
        `SELECT s.session_id, s.title,
                (SELECT COUNT(*) FROM session_attendance sa WHERE sa.session_id = s.session_id) AS current_attendance
         FROM sessions s
         WHERE s.venue_id = $1 AND s.start_time <= NOW() AND s.end_time >= NOW()
         ORDER BY s.start_time DESC LIMIT 1`,
        [ctx.venue_id]
      );
      const currentSession = currentSessionRow.rows[0] || null;

      const recentCheckinsRow = await query(
        `SELECT COUNT(*) AS recent FROM checkins c
         JOIN registrations r ON r.registration_id = c.registration_id
         WHERE c.checkin_time > NOW() - INTERVAL '10 minutes'`
      );

      return {
        venue,
        currentSession,
        currentAttendance: currentSession ? parseInt(currentSession.current_attendance, 10) : 0,
        recentCheckins: parseInt(recentCheckinsRow.rows[0].recent, 10),
      };
    },
  },

  // ---- 2. Event Intelligence Engine: capacity analysis ----
  {
    name: "intelligence-engine-capacity-analysis",
    agent: "event-intelligence-engine",
    onError: "abort",
    run: async (ctx) => {
      const capacityPct = ctx.venue.capacity > 0 ? Math.round((ctx.currentAttendance / ctx.venue.capacity) * 100) : 0;
      return { capacityPct };
    },
  },

  // ---- 3. Event Intelligence Engine: risk detection ----
  {
    name: "intelligence-engine-risk-detection",
    agent: "event-intelligence-engine",
    onError: "continue",
    run: async (ctx) => {
      const nextSessionRow = await query(
        `SELECT title, start_time FROM sessions
         WHERE venue_id = $1 AND start_time > NOW()
         ORDER BY start_time ASC LIMIT 1`,
        [ctx.venue_id]
      );
      const nextSession = nextSessionRow.rows[0] || null;
      const minutesToNextSession = nextSession ? Math.round((new Date(nextSession.start_time).getTime() - Date.now()) / 60000) : null;

      const imminentNextSession = minutesToNextSession !== null && minutesToNextSession <= 15;
      const highVelocityCheckins = ctx.recentCheckins >= 20;

      const riskLevel =
        ctx.capacityPct >= 90 && (imminentNextSession || highVelocityCheckins) ? "critical" :
        ctx.capacityPct >= 90 ? "high" :
        ctx.capacityPct >= 70 ? "moderate" : "low";

      return { nextSession, minutesToNextSession, imminentNextSession, highVelocityCheckins, riskLevel };
    },
  },

  // ---- 4. Operational Alert ----
  {
    name: "operational-alert-create",
    agent: "operational-alerting",
    onError: "continue",
    run: async (ctx) => {
      if (ctx.riskLevel === "low") return { alertCreated: false };
      const alertLevel = ctx.riskLevel === "critical" ? "critical" : ctx.riskLevel === "high" ? "high" : "medium";
      await query(
        `INSERT INTO operational_alerts (alert_level, source_type, source_id, title, message, is_ai_generated)
         VALUES ($1, 'venue', $2, $3, $4, false)`,
        [
          alertLevel,
          ctx.venue_id,
          `High crowd density expected at ${ctx.venue.name}`,
          `${ctx.venue.name} is at ${ctx.capacityPct}% capacity` +
            (ctx.recentCheckins ? ` with ${ctx.recentCheckins} check-ins in the last 10 minutes` : "") +
            (ctx.nextSession ? `; "${ctx.nextSession.title}" starts in ${ctx.minutesToNextSession} minutes.` : "."),
        ]
      );
      return { alertCreated: true, alertLevel };
    },
  },

  // ---- 5. Recommendation Engine: recommended action ----
  // Deterministic, rule-based text — the same style of output as the
  // brief's example sentence, generated without an LLM call so this
  // workflow has zero external dependencies.
  {
    name: "recommendation-engine-recommended-action",
    agent: "recommendation-engine",
    onError: "continue",
    run: async (ctx) => {
      if (ctx.riskLevel === "low") return { recommendedAction: null };
      const actions = [];
      if (ctx.capacityPct >= 90) actions.push("deploying additional check-in staff");
      if (ctx.highVelocityCheckins) actions.push("opening an alternative entry point");
      if (ctx.imminentNextSession) actions.push(`preparing overflow seating before "${ctx.nextSession.title}" begins`);
      if (actions.length === 0) actions.push("monitoring the queue closely over the next few minutes");

      const recommendedAction = `High crowd density ${ctx.riskLevel === "critical" ? "is" : "may be"} expected at ${ctx.venue.name}. Consider ${actions.join(" and ")}.`;
      return { recommendedAction };
    },
  },

  // ---- 6. Executive Dashboard: update event status ----
  {
    name: "executive-dashboard-update",
    agent: "executive-dashboard",
    onError: "continue",
    run: async () => {
      clearCache();
      return { dashboardRefreshed: true };
    },
  },
];

defineWorkflow("high-crowd", steps);

export default steps;
