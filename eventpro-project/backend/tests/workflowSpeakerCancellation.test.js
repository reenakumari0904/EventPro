import { jest } from "@jest/globals";

jest.unstable_mockModule("../config/db.js", () => import("./mockDb.js"));

const { query } = await import("../config/db.js");
// Importing the workflow module registers "speaker-cancellation" with the
// engine as a side effect (see services/workflows/index.js).
await import("../services/workflows/speakerCancellation.js");
const { startWorkflow, resumeWorkflow, _resetForTests } = await import("../services/workflows/engine.js");

const SESSION_ID = 501;
const INCIDENT_ID = 900;

function baseSession({ minutesToStart = 200, expected_attendees = 10, venue_id = 1 } = {}) {
  return {
    session_id: SESSION_ID,
    title: "Scaling Postgres at 10x",
    start_time: new Date(Date.now() + minutesToStart * 60000).toISOString(),
    end_time: new Date(Date.now() + (minutesToStart + 45) * 60000).toISOString(),
    expected_attendees,
    venue_id,
    venue_name: "Hall A",
    venue_capacity: 120,
    speaker_name: "Dr. Rao",
    speaker_email: "rao@example.com",
  };
}

// Routes the shared mock query() by recognizable fragments of each SQL
// statement the workflow issues, in the order described in
// services/workflows/speakerCancellation.js.
function installMockRouter({ session, attendanceRows = [], alternativeVenues = [], incidentSeverity = "high" }) {
  let incidentRow = null;

  query.mockImplementation(async (sql, params) => {
    const s = typeof sql === "string" ? sql : "";

    if (s.includes("LEFT JOIN venues v ON v.venue_id = s.venue_id") && s.includes("WHERE s.session_id = $1")) {
      return { rows: [session] };
    }
    if (s.includes("FROM session_attendance sa") && s.includes("JOIN users u")) {
      return { rows: attendanceRows };
    }
    if (s.includes("FROM venues v") && s.includes("v.capacity >= $1")) {
      return { rows: alternativeVenues };
    }
    if (s.includes("INSERT INTO incidents")) {
      incidentRow = {
        incident_id: INCIDENT_ID,
        title: params[0],
        description: params[1],
        incident_type: params[2],
        severity: incidentSeverity,
        session_id: params[4],
        venue_id: params[5],
        status: "reported",
      };
      return { rows: [incidentRow] };
    }
    if (s.includes("INSERT INTO incident_workflow_log")) {
      return { rows: [] };
    }
    if (s.includes("SELECT * FROM incidents WHERE incident_id")) {
      return { rows: [incidentRow] };
    }
    if (s.includes("UPDATE incidents SET severity")) {
      incidentRow = { ...incidentRow, severity: "critical", status: "escalated" };
      return { rows: [incidentRow] };
    }
    if (s.includes("INSERT INTO operational_alerts")) {
      return { rows: [] };
    }
    // rescheduleSessionRecord's plain lookup — distinct from the joined
    // lookup above (no "LEFT JOIN venues v ON v.venue_id = s.venue_id").
    if (s.startsWith("SELECT * FROM sessions WHERE session_id")) {
      return { rows: [session] };
    }
    if (s.includes("WHERE venue_id = $1 AND session_id !=")) {
      return { rows: [] }; // no venue conflict
    }
    if (s.includes("WHERE speaker_id = $1 AND session_id !=")) {
      return { rows: [] }; // no speaker conflict
    }
    if (s.includes("UPDATE sessions SET start_time")) {
      const updated = { ...session, venue_id: params[2], speaker_id: params[3] };
      return { rows: [updated] };
    }
    if (s.includes("INSERT INTO speaker_schedule_log")) {
      return { rows: [] };
    }
    throw new Error(`Unmocked query in workflow test: ${s.slice(0, 80)}`);
  });

  return () => incidentRow;
}

describe("Workflow: speaker-cancellation (full agent chain)", () => {
  beforeEach(() => {
    query.mockReset();
    _resetForTests();
  });

  it("runs the full chain, auto-escalates on severe impact, and executes the venue swap after human approval", async () => {
    const session = baseSession({ minutesToStart: 30 }); // <=60 -> severe
    const alternativeVenues = [{ venue_id: 7, name: "Hall C", capacity: 50 }];
    installMockRouter({ session, attendanceRows: [], alternativeVenues, incidentSeverity: "high" });

    const started = await startWorkflow(
      "speaker-cancellation",
      { session_id: SESSION_ID, reason: "Speaker had a family emergency." },
      { triggeredBy: "admin@example.com" }
    );

    // Step 1: detected the session and computed time-to-start.
    expect(started.context.session.title).toBe(session.title);
    expect(started.context.minutesToStart).toBeLessThanOrEqual(30);

    // Step 2: impact analysis fell back to expected_attendees (no attendance rows) and flagged "severe".
    expect(started.context.attendeeSource).toBe("expected_attendees_estimate");
    expect(started.context.impactLevel).toBe("severe");

    // Step 3: found an alternative venue.
    expect(started.context.alternativeVenues).toHaveLength(1);

    // Step 5 + 5b: incident created, then auto-escalated because impact was severe.
    expect(started.context.incident.incident_id).toBe(INCIDENT_ID);
    expect(started.context.escalated).toBe(true);
    expect(started.context.incident.severity).toBe("critical");

    // Step 7: paused for human approval because an alternative venue exists.
    expect(started.status).toBe("awaiting_approval");
    expect(started.pending_approval.prompt).toMatch(/Hall C/);
    expect(started.context.sessionReassigned).toBeUndefined();

    const resumed = await resumeWorkflow(started.id, { approved: true, decidedBy: "ops-lead@example.com" });

    expect(resumed.status).toBe("completed");
    expect(resumed.context.sessionReassigned).toBe(true);
    expect(resumed.context.rescheduledSession.venue_id).toBe(7);
    expect(resumed.context.dashboardRefreshed).toBe(true);
    expect(resumed.steps.map((s) => s.status)).toEqual(Array(9).fill("ok"));
  });

  it("skips the human-approval step entirely when no alternative venue exists, and does not escalate a minor-impact incident", async () => {
    const session = baseSession({ minutesToStart: 400, expected_attendees: 5 }); // well outside severe/moderate thresholds
    installMockRouter({ session, attendanceRows: [], alternativeVenues: [], incidentSeverity: "high" });

    const run = await startWorkflow("speaker-cancellation", { session_id: SESSION_ID }, { triggeredBy: "admin" });

    expect(run.context.impactLevel).toBe("minor");
    expect(run.context.escalated).toBe(false);
    // requiresApproval() was false (no alternatives), so the run completes in one pass.
    expect(run.status).toBe("completed");
    const approvalStep = run.steps.find((s) => s.name === "human-approval-venue-swap");
    expect(approvalStep.status).toBe("ok"); // executed as a no-op-approval step, never paused
  });

  it("escalates the incident again (via onReject) and never touches the session when an admin rejects the swap", async () => {
    const session = baseSession({ minutesToStart: 30 });
    const alternativeVenues = [{ venue_id: 7, name: "Hall C", capacity: 50 }];
    installMockRouter({ session, attendanceRows: [], alternativeVenues, incidentSeverity: "high" });

    const started = await startWorkflow("speaker-cancellation", { session_id: SESSION_ID }, { triggeredBy: "admin" });
    expect(started.status).toBe("awaiting_approval");

    const rejected = await resumeWorkflow(started.id, { approved: false, decidedBy: "ops-lead@example.com", note: "Hall C has no AV setup." });

    expect(rejected.status).toBe("rejected");
    expect(rejected.context.sessionReassigned).toBeUndefined();
    // UPDATE sessions should never have been called for a rejected swap.
    expect(query.mock.calls.some(([sql]) => typeof sql === "string" && sql.includes("UPDATE sessions SET start_time"))).toBe(false);
    // But the onReject hook re-escalated the incident so it isn't lost.
    expect(query.mock.calls.some(([sql]) => typeof sql === "string" && sql.includes("UPDATE incidents SET severity"))).toBe(true);
  });

  it("aborts cleanly when the session doesn't exist", async () => {
    query.mockImplementation(async (sql) => {
      if (typeof sql === "string" && sql.includes("WHERE s.session_id = $1")) return { rows: [] };
      throw new Error("should not reach further queries");
    });

    const run = await startWorkflow("speaker-cancellation", { session_id: 999999 }, { triggeredBy: "admin" });
    expect(run.status).toBe("failed");
    expect(run.steps[0].status).toBe("error");
    expect(run.steps[0].error).toMatch(/not found/);
    expect(run.steps[1].status).toBe("pending"); // never reached
  });
});
