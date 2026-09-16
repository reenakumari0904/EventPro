// ============================================================
// Workflow: Venue Issue
// ============================================================
// Milestone brief, "Scenario 3 – Venue Issue":
//   Venue issue → Incident Agent → Severity classification → Team
//   assignment → Alert → Resolution → Closure.
//
// The "Closure" step is where this workflow uses its human-approval gate:
// an ops agent fixes the issue in the physical world, and an admin
// confirms it's actually resolved before the incident is closed — that
// confirmation is exactly the kind of decision an autonomous agent
// shouldn't make unilaterally.
//
// Trigger: POST /api/workflows/venue-issue  { venue_id, issue_type, description }

import { query } from "../../config/db.js";
import { createIncidentRecord } from "../../controllers/incident.controller.js";
import { clearCache } from "../../utils/cache.js";
import { defineWorkflow } from "./engine.js";

// A small, explicit severity table for this workflow's own
// "Severity classification" step — deliberately separate from (and
// coarser than) incident.controller.js's internal SEVERITY_MAP, since here
// the input is a free-form issue_type chosen at trigger time, not a fixed
// incident_type enum.
const ISSUE_SEVERITY = {
  power_outage: "critical",
  structural: "critical",
  av_failure: "high",
  hvac: "medium",
  cleanliness: "low",
  other: "medium",
};

// Deterministic, capacity-planning-free "team assignment" — there's no
// staff/roster table in the schema, so this maps issue categories to the
// operations team that owns them, which is what "which agent/team should
// respond" means for a physical-facilities problem.
const TEAM_FOR_ISSUE = {
  power_outage: "Facilities & Electrical",
  structural: "Facilities & Safety",
  av_failure: "AV/Technical Support",
  hvac: "Facilities & Electrical",
  cleanliness: "Housekeeping",
  other: "General Operations",
};

const steps = [
  // ---- 1. Venue Agent: report the issue ----
  {
    name: "venue-agent-report-issue",
    agent: "venue-agent",
    onError: "abort",
    run: async (ctx) => {
      const result = await query(`SELECT * FROM venues WHERE venue_id = $1`, [ctx.venue_id]);
      const venue = result.rows[0];
      if (!venue) throw new Error(`Venue ${ctx.venue_id} not found.`);
      return { venue };
    },
  },

  // ---- 2. Incident Agent: severity classification ----
  {
    name: "incident-agent-severity-classification",
    agent: "incident-agent",
    onError: "continue",
    run: async (ctx) => {
      const issueType = ctx.issue_type && ISSUE_SEVERITY[ctx.issue_type] ? ctx.issue_type : "other";
      return { classifiedSeverity: ISSUE_SEVERITY[issueType], normalizedIssueType: issueType };
    },
  },

  // ---- 3. Incident Agent: create the incident at that severity ----
  {
    name: "incident-agent-create-incident",
    agent: "incident-agent",
    onError: "abort",
    run: async (ctx) => {
      const incident = await createIncidentRecord({
        title: `Venue issue at ${ctx.venue.name}: ${ctx.normalizedIssueType.replace(/_/g, " ")}`,
        description: ctx.description || `${ctx.normalizedIssueType.replace(/_/g, " ")} reported at ${ctx.venue.name}.`,
        incident_type: "venue_technical",
        venue_id: ctx.venue_id,
        severity: ctx.classifiedSeverity, // explicit override — see step 2's classification
        reported_by: ctx.triggeredBy || "agent-orchestrator",
      });
      return { incident };
    },
  },

  // ---- 4. Ops team assignment ----
  {
    name: "ops-agent-team-assignment",
    agent: "ops-team-assignment",
    onError: "continue",
    run: async (ctx) => {
      const assignedTeam = TEAM_FOR_ISSUE[ctx.normalizedIssueType];
      await query(
        `INSERT INTO incident_workflow_log (incident_id, from_status, to_status, action, notes, actor)
         VALUES ($1, 'reported', 'assigned', 'team_assignment', $2, $3)`,
        [ctx.incident.incident_id, `Routed to ${assignedTeam}.`, "agent-orchestrator"]
      );
      return { assignedTeam };
    },
    // The alert step in incident creation already notified the manager, so
    // there's no separate "Operational Alert" step here — the brief lists
    // it as its own box in the diagram, but it's the same alert.
  },

  // ---- 5. Mark the incident in progress while the team works it ----
  {
    name: "incident-agent-mark-in-progress",
    agent: "incident-agent",
    onError: "continue",
    run: async (ctx) => {
      await query(`UPDATE incidents SET status = 'in_progress' WHERE incident_id = $1`, [ctx.incident.incident_id]);
      await query(
        `INSERT INTO incident_workflow_log (incident_id, from_status, to_status, action, notes, actor)
         VALUES ($1, 'assigned', 'in_progress', 'work_started', $2, $3)`,
        [ctx.incident.incident_id, `${ctx.assignedTeam || "Operations"} is working the issue.`, "agent-orchestrator"]
      );
      return { markedInProgress: true };
    },
  },

  // ---- 6. Human approval: confirm resolution before closing ----
  {
    name: "human-approval-confirm-resolution",
    agent: "human-approval",
    onError: "continue",
    requiresApproval: () => true, // closure always needs a human sign-off, unlike the speaker workflow's conditional gate
    approvalPrompt: (ctx) => `Confirm the ${ctx.normalizedIssueType.replace(/_/g, " ")} issue at ${ctx.venue.name} (incident #${ctx.incident.incident_id}, assigned to ${ctx.assignedTeam}) has been resolved and can be closed?`,
    run: async (ctx) => {
      await query(`UPDATE incidents SET status = 'resolved' WHERE incident_id = $1`, [ctx.incident.incident_id]);
      await query(
        `INSERT INTO incident_workflow_log (incident_id, from_status, to_status, action, notes, actor)
         VALUES ($1, 'in_progress', 'resolved', 'closure_confirmed', $2, $3)`,
        [ctx.incident.incident_id, "Closure confirmed by an admin.", ctx.decidedBy || "admin"]
      );
      return { resolved: true };
    },
    onReject: async (ctx) => {
      await query(
        `INSERT INTO incident_workflow_log (incident_id, from_status, to_status, action, notes, actor)
         VALUES ($1, 'in_progress', 'in_progress', 'closure_rejected', $2, $3)`,
        [ctx.incident.incident_id, ctx.note ? `Not yet resolved: ${ctx.note}` : "Closure rejected — issue remains open.", ctx.decidedBy || "admin"]
      );
    },
  },

  // ---- 7. Executive Dashboard: update event status ----
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

defineWorkflow("venue-issue", steps);

export default steps;
