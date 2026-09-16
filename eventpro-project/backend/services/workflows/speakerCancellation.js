// ============================================================
// Workflow: Speaker Cancellation
// ============================================================
// This is the exact chain from the milestone brief's "Simple Example":
//
//   Speaker Agent            -> Detects the cancellation
//   Event Intelligence Engine -> Analyzes the impact
//   Venue Agent               -> Checks available rooms/times
//   Registration/Attendee System -> Identifies affected attendees
//   Incident Agent             -> Creates an incident
//   (auto-escalates the incident if the impact is severe)
//   Operational Alert          -> Notifies the event manager
//   [Human approval]           -> Confirms (or rejects) an auto-proposed
//                                  venue swap before anything is changed
//   Executive Dashboard        -> Updates event status
//
// Every step is a real function against the real database — nothing here
// is simulated. Trigger it via POST /api/workflows/speaker-cancellation.

import { query } from "../../config/db.js";
import { createIncidentRecord, escalateIncidentRecord } from "../../controllers/incident.controller.js";
import { rescheduleSessionRecord } from "../../controllers/session.controller.js";
import { clearCache } from "../../utils/cache.js";
import { defineWorkflow } from "./engine.js";

const steps = [
  // ---- 1. Speaker Agent: detect the cancellation ----
  {
    name: "speaker-agent-detect-cancellation",
    agent: "speaker-agent",
    onError: "abort", // nothing downstream can proceed without a real session
    run: async (ctx) => {
      const result = await query(
        `SELECT s.*, v.name AS venue_name, v.capacity AS venue_capacity,
                sp.name AS speaker_name, sp.email AS speaker_email
         FROM sessions s
         LEFT JOIN venues v ON v.venue_id = s.venue_id
         LEFT JOIN speakers sp ON sp.speaker_id = s.speaker_id
         WHERE s.session_id = $1`,
        [ctx.session_id]
      );
      const session = result.rows[0];
      if (!session) throw new Error(`Session ${ctx.session_id} not found.`);

      const minutesToStart = Math.round((new Date(session.start_time).getTime() - Date.now()) / 60000);
      return { session, originalSpeakerName: session.speaker_name, minutesToStart };
    },
  },

  // ---- 2. Event Intelligence Engine: analyze the impact ----
  {
    name: "intelligence-engine-impact-analysis",
    agent: "event-intelligence-engine",
    onError: "continue", // fall back to a conservative default rather than block the incident
    run: async (ctx) => {
      const attendance = await query(
        `SELECT u.name, u.email
         FROM session_attendance sa
         JOIN registrations r ON r.registration_id = sa.registration_id
         JOIN users u ON u.user_id = r.user_id
         WHERE sa.session_id = $1`,
        [ctx.session_id]
      );
      const attendeeSource = attendance.rows.length > 0 ? "session_attendance" : "expected_attendees_estimate";
      const affectedAttendees = attendance.rows.length > 0 ? attendance.rows.length : (ctx.session.expected_attendees || 0);

      const impactLevel =
        ctx.minutesToStart <= 60 || affectedAttendees >= 50 ? "severe" :
        ctx.minutesToStart <= 180 || affectedAttendees >= 20 ? "moderate" : "minor";

      return { affectedAttendees, attendeeSource, impactLevel };
    },
  },

  // ---- 3. Venue Agent: check available rooms/times ----
  {
    name: "venue-agent-check-alternatives",
    agent: "venue-agent",
    onError: "continue", // informational — a workflow can still create/escalate the incident without a swap candidate
    run: async (ctx) => {
      const { session } = ctx;
      const capacityNeeded = session.expected_attendees || 1;
      const alternatives = await query(
        `SELECT v.venue_id, v.name, v.capacity
         FROM venues v
         WHERE v.capacity >= $1
           AND v.venue_id IS DISTINCT FROM $2
           AND v.venue_id NOT IN (
             SELECT s.venue_id FROM sessions s
             WHERE s.venue_id IS NOT NULL AND s.session_id != $3
               AND s.start_time < $5 AND s.end_time > $4
           )
         ORDER BY v.capacity ASC
         LIMIT 3`,
        [capacityNeeded, session.venue_id, session.session_id, session.start_time, session.end_time]
      );
      return { alternativeVenues: alternatives.rows };
    },
  },

  // ---- 4. Registration/Attendee System: identify affected attendees ----
  {
    name: "registration-system-identify-attendees",
    agent: "registration-agent",
    onError: "continue",
    run: async (ctx) => {
      const rows = await query(
        `SELECT u.name, u.email
         FROM session_attendance sa
         JOIN registrations r ON r.registration_id = sa.registration_id
         JOIN users u ON u.user_id = r.user_id
         WHERE sa.session_id = $1`,
        [ctx.session_id]
      );
      return { attendeesToNotify: rows.rows, attendeesToNotifyCount: rows.rows.length };
    },
  },

  // ---- 5. Incident Agent: create the incident ----
  {
    name: "incident-agent-create-incident",
    agent: "incident-agent",
    onError: "abort", // if we can't even record the incident, the run should surface as failed, not silently continue
    run: async (ctx) => {
      const incident = await createIncidentRecord({
        title: `Speaker cancellation: ${ctx.session.title}`,
        description: ctx.reason || `${ctx.originalSpeakerName || "The assigned speaker"} cancelled. ${ctx.affectedAttendees ?? "an unknown number of"} attendees affected (${ctx.attendeeSource || "estimate"}); session starts in ${ctx.minutesToStart} minutes.`,
        incident_type: "speaker_cancellation",
        session_id: ctx.session_id,
        venue_id: ctx.session.venue_id,
        reported_by: ctx.triggeredBy || "agent-orchestrator",
      });
      return { incident };
    },
  },

  // ---- 5b. Incident Agent: auto-escalate if the impact is severe ----
  {
    name: "incident-agent-auto-escalate",
    agent: "incident-agent",
    onError: "continue",
    run: async (ctx) => {
      if (ctx.impactLevel !== "severe") return { escalated: false };
      const escalated = await escalateIncidentRecord(ctx.incident.incident_id, {
        notes: `Auto-escalated by the orchestration workflow: severe impact (${ctx.affectedAttendees} attendees, session starts in ${ctx.minutesToStart} min).`,
        actor: "agent-orchestrator",
      });
      return { incident: escalated, escalated: true };
    },
  },

  // ---- 6. Operational Alert: notify the event manager ----
  // createIncidentRecord/escalateIncidentRecord already insert an alert
  // (see insertAlertForIncident in incident.controller.js); this step adds
  // a second, specific alert only when there's a concrete swap to review.
  {
    name: "operational-alert-notify-manager",
    agent: "operational-alerting",
    onError: "continue",
    run: async (ctx) => {
      if (!ctx.alternativeVenues?.length) return { managerNotified: true, swapAlertCreated: false };
      const best = ctx.alternativeVenues[0];
      await query(
        `INSERT INTO operational_alerts (alert_level, source_type, source_id, title, message, is_ai_generated)
         VALUES ($1, 'schedule', $2, $3, $4, false)`,
        [
          "medium",
          ctx.session_id,
          `Alternative venue available for "${ctx.session.title}"`,
          `${best.name} (capacity ${best.capacity}) is free during the original time slot. Awaiting admin approval to reassign — see workflow run ${ctx.runId}.`,
        ]
      );
      return { managerNotified: true, swapAlertCreated: true };
    },
  },

  // ---- 7. Human approval gate: confirm the proposed venue swap ----
  // Only pauses for approval when there's actually something to approve
  // (a candidate venue). If none was found, this step is skipped
  // entirely — requiresApproval() returning false means the engine moves
  // straight past it without pausing.
  {
    name: "human-approval-venue-swap",
    agent: "human-approval",
    onError: "continue",
    requiresApproval: (ctx) => Boolean(ctx.alternativeVenues?.length),
    approvalPrompt: (ctx) =>
      `Reassign "${ctx.session.title}" to ${ctx.alternativeVenues[0].name} (capacity ${ctx.alternativeVenues[0].capacity}) at the original time? ` +
      `Original speaker (${ctx.originalSpeakerName || "unknown"}) remains unassigned — this only confirms the room. Incident #${ctx.incident.incident_id} is ${ctx.escalated ? "escalated" : "open"}.`,
    run: async (ctx) => {
      if (!ctx.alternativeVenues?.length) return { sessionReassigned: false }; // nothing to approve/execute — see requiresApproval above
      const proposedVenue = ctx.alternativeVenues[0];
      const updatedSession = await rescheduleSessionRecord(ctx.session_id, {
        venue_id: proposedVenue.venue_id,
        speaker_id: null, // the swap only confirms the room; a new speaker is a separate, manual decision
        reasoning: `Venue auto-reassigned by the Agent Orchestration workflow (run ${ctx.runId}) after human approval.`,
        actor: "agent-orchestrator",
      });
      return { rescheduledSession: updatedSession, sessionReassigned: true };
    },
    onReject: async (ctx) => {
      // A rejected swap still needs a human to resolve the session manually —
      // escalate so it doesn't quietly fall through the cracks.
      await escalateIncidentRecord(ctx.incident.incident_id, {
        notes: `Proposed venue swap was rejected${ctx.decidedBy ? ` by ${ctx.decidedBy}` : ""}; needs manual rescheduling.${ctx.note ? ` Note: ${ctx.note}` : ""}`,
        actor: ctx.decidedBy || "admin",
      });
    },
  },

  // ---- 8. Executive Dashboard: update event status ----
  {
    name: "executive-dashboard-update",
    agent: "executive-dashboard",
    onError: "continue",
    run: async () => {
      // Invalidate the orchestrator's short-TTL cache so the next dashboard
      // poll/SSE tick reflects this incident and alert immediately instead
      // of waiting out the cache window.
      clearCache();
      return { dashboardRefreshed: true };
    },
  },
];

defineWorkflow("speaker-cancellation", steps);

export default steps;
