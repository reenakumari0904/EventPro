import { jest } from "@jest/globals";

jest.unstable_mockModule("../config/db.js", () => import("./mockDb.js"));

const { query } = await import("../config/db.js");
// Registers sponsor-performance, venue-issue, and high-crowd with the engine.
await import("../services/workflows/sponsorPerformance.js");
await import("../services/workflows/venueIssue.js");
await import("../services/workflows/highCrowd.js");
const { startWorkflow, resumeWorkflow, _resetForTests } = await import("../services/workflows/engine.js");

beforeEach(() => {
  query.mockReset();
  _resetForTests();
});

// ============================================================
// Scenario 2 — Sponsor Performance
// ============================================================
describe("Workflow: sponsor-performance", () => {
  const SPONSOR_ID = 42;

  function mockSponsor({ tier = "Silver", leads = 40, conversions = 12 } = {}) {
    let incidentInsertCalled = false;
    query.mockImplementation(async (sql, params) => {
      const s = typeof sql === "string" ? sql : "";
      if (s.includes("FROM sponsors WHERE sponsor_id")) {
        return { rows: [{ sponsor_id: SPONSOR_ID, name: "Acme Corp", tier }] };
      }
      if (s.includes("FROM sponsor_engagement WHERE sponsor_id")) {
        return { rows: [{ metric_type: "lead", total: String(leads) }, { metric_type: "conversion", total: String(conversions) }] };
      }
      if (s.includes("INSERT INTO incidents")) {
        incidentInsertCalled = true;
        return { rows: [{ incident_id: 77, title: params[0], severity: "medium" }] };
      }
      if (s.includes("INSERT INTO incident_workflow_log") || s.includes("INSERT INTO operational_alerts")) {
        return { rows: [] };
      }
      throw new Error(`Unmocked query: ${s.slice(0, 80)}`);
    });
    return () => incidentInsertCalled;
  }

  it("calculates leads, conversion rate, and ROI indicator end-to-end for a healthy sponsor", async () => {
    mockSponsor({ tier: "Silver", leads: 40, conversions: 24 }); // 60% -> "good", not high-value tier anyway
    const run = await startWorkflow("sponsor-performance", { sponsor_id: SPONSOR_ID }, { triggeredBy: "admin" });

    expect(run.status).toBe("completed");
    expect(run.context.leadsGenerated).toBe(40);
    expect(run.context.conversions).toBe(24);
    expect(run.context.conversionRatePct).toBe(60);
    expect(run.context.roiPct).toBe(60);
    expect(run.context.roiLevel).toBe("good");
    expect(run.context.flagged).toBe(false); // ROI is good, nothing to flag
    expect(run.context.dashboardRefreshed).toBe(true);
  });

  it("flags a Platinum sponsor with poor ROI as an incident for account-manager follow-up", async () => {
    const incidentWasCreated = mockSponsor({ tier: "Platinum", leads: 50, conversions: 5 }); // 10% -> "poor"
    const run = await startWorkflow("sponsor-performance", { sponsor_id: SPONSOR_ID }, { triggeredBy: "admin" });

    expect(run.context.roiLevel).toBe("poor");
    expect(run.context.flagged).toBe(true);
    expect(run.context.incident.incident_id).toBe(77);
    expect(incidentWasCreated()).toBe(true);
  });

  it("does not flag a low-tier sponsor even with poor ROI (only Platinum/Gold trigger the alert)", async () => {
    const incidentWasCreated = mockSponsor({ tier: "Bronze", leads: 50, conversions: 2 }); // 4% -> "poor" but low tier
    const run = await startWorkflow("sponsor-performance", { sponsor_id: SPONSOR_ID }, { triggeredBy: "admin" });

    expect(run.context.roiLevel).toBe("poor");
    expect(run.context.flagged).toBe(false);
    expect(incidentWasCreated()).toBe(false);
  });

  it("aborts cleanly when the sponsor doesn't exist", async () => {
    query.mockImplementation(async (sql) => {
      if (typeof sql === "string" && sql.includes("FROM sponsors WHERE sponsor_id")) return { rows: [] };
      throw new Error("should not reach further queries");
    });
    const run = await startWorkflow("sponsor-performance", { sponsor_id: 999999 }, { triggeredBy: "admin" });
    expect(run.status).toBe("failed");
    expect(run.steps[0].error).toMatch(/not found/);
  });
});

// ============================================================
// Scenario 3 — Venue Issue
// ============================================================
describe("Workflow: venue-issue", () => {
  const VENUE_ID = 5;
  const INCIDENT_ID = 88;

  function mockVenueIssue() {
    let incidentRow = null;
    const statusUpdates = [];
    query.mockImplementation(async (sql, params) => {
      const s = typeof sql === "string" ? sql : "";
      if (s.includes("FROM venues WHERE venue_id")) return { rows: [{ venue_id: VENUE_ID, name: "Hall B" }] };
      if (s.includes("INSERT INTO incidents")) {
        incidentRow = { incident_id: INCIDENT_ID, title: params[0], severity: params[3] };
        return { rows: [incidentRow] };
      }
      if (s.includes("INSERT INTO incident_workflow_log")) return { rows: [] };
      if (s.includes("INSERT INTO operational_alerts")) return { rows: [] };
      if (s.includes("UPDATE incidents SET status")) {
        if (s.includes("'in_progress'")) statusUpdates.push("in_progress");
        else if (s.includes("'resolved'")) statusUpdates.push("resolved");
        return { rows: [] };
      }
      throw new Error(`Unmocked query: ${s.slice(0, 80)}`);
    });
    return { getIncident: () => incidentRow, getStatusUpdates: () => statusUpdates };
  }

  it("classifies severity, assigns a team, and pauses for closure approval", async () => {
    const mocks = mockVenueIssue();
    const started = await startWorkflow(
      "venue-issue",
      { venue_id: VENUE_ID, issue_type: "power_outage", description: "Power out in the east wing." },
      { triggeredBy: "admin" }
    );

    expect(started.context.classifiedSeverity).toBe("critical"); // power_outage -> critical
    expect(started.context.incident.severity).toBe("critical");
    expect(started.context.assignedTeam).toBe("Facilities & Electrical");
    expect(started.context.markedInProgress).toBe(true);
    expect(mocks.getStatusUpdates()).toEqual(["in_progress"]);

    // Closure always requires approval for this workflow.
    expect(started.status).toBe("awaiting_approval");
    expect(started.pending_approval.prompt).toMatch(/Hall B/);

    const resumed = await resumeWorkflow(started.id, { approved: true, decidedBy: "ops-lead@example.com" });
    expect(resumed.status).toBe("completed");
    expect(resumed.context.resolved).toBe(true);
    expect(mocks.getStatusUpdates()).toEqual(["in_progress", "resolved"]);
    expect(resumed.context.dashboardRefreshed).toBe(true);
  });

  it("falls back to 'other' (medium severity) for an unrecognized issue_type", async () => {
    mockVenueIssue();
    const run = await startWorkflow("venue-issue", { venue_id: VENUE_ID, issue_type: "something-unheard-of" }, { triggeredBy: "admin" });
    expect(run.context.normalizedIssueType).toBe("other");
    expect(run.context.classifiedSeverity).toBe("medium");
    expect(run.context.assignedTeam).toBe("General Operations");
  });

  it("leaves the incident in_progress (not resolved) when closure is rejected", async () => {
    const mocks = mockVenueIssue();
    const started = await startWorkflow("venue-issue", { venue_id: VENUE_ID, issue_type: "hvac" }, { triggeredBy: "admin" });
    const rejected = await resumeWorkflow(started.id, { approved: false, decidedBy: "ops-lead@example.com", note: "Still too warm." });

    expect(rejected.status).toBe("rejected");
    expect(mocks.getStatusUpdates()).toEqual(["in_progress"]); // never moved to "resolved"
  });
});

// ============================================================
// Scenario 4 — High Crowd
// ============================================================
describe("Workflow: high-crowd", () => {
  const VENUE_ID = 9;

  function mockHighCrowd({ capacity = 100, currentAttendance = 95, recentCheckins = 25, nextSessionMinutes = 10 } = {}) {
    const alertsCreated = [];
    query.mockImplementation(async (sql, params) => {
      const s = typeof sql === "string" ? sql : "";
      if (s.includes("FROM venues WHERE venue_id")) return { rows: [{ venue_id: VENUE_ID, name: "Hall A", capacity }] };
      if (s.includes("current_attendance")) {
        return { rows: [{ session_id: 1, title: "Keynote", current_attendance: String(currentAttendance) }] };
      }
      if (s.includes("FROM checkins c")) return { rows: [{ recent: String(recentCheckins) }] };
      if (s.includes("start_time > NOW()")) {
        return {
          rows: nextSessionMinutes === null ? [] : [{ title: "Panel Discussion", start_time: new Date(Date.now() + nextSessionMinutes * 60000).toISOString() }],
        };
      }
      if (s.includes("INSERT INTO operational_alerts")) {
        alertsCreated.push(params);
        return { rows: [] };
      }
      throw new Error(`Unmocked query: ${s.slice(0, 80)}`);
    });
    return () => alertsCreated;
  }

  it("flags critical risk and produces a concrete recommendation when capacity is high and the next session is imminent", async () => {
    const getAlerts = mockHighCrowd({ capacity: 100, currentAttendance: 95, recentCheckins: 25, nextSessionMinutes: 10 });
    const run = await startWorkflow("high-crowd", { venue_id: VENUE_ID }, { triggeredBy: "admin" });

    expect(run.status).toBe("completed");
    expect(run.context.capacityPct).toBe(95);
    expect(run.context.riskLevel).toBe("critical");
    expect(run.context.alertCreated).toBe(true);
    expect(getAlerts()).toHaveLength(1);
    expect(run.context.recommendedAction).toMatch(/Hall A/);
    expect(run.context.recommendedAction).toMatch(/check-in staff/);
    expect(run.context.recommendedAction).toMatch(/alternative entry point/);
  });

  it("does not alert or recommend anything when the venue is comfortably under capacity", async () => {
    const getAlerts = mockHighCrowd({ capacity: 200, currentAttendance: 40, recentCheckins: 2, nextSessionMinutes: 120 });
    const run = await startWorkflow("high-crowd", { venue_id: VENUE_ID }, { triggeredBy: "admin" });

    expect(run.context.riskLevel).toBe("low");
    expect(run.context.alertCreated).toBe(false);
    expect(run.context.recommendedAction).toBeNull();
    expect(getAlerts()).toHaveLength(0);
  });

  it("aborts cleanly when the venue doesn't exist", async () => {
    query.mockImplementation(async (sql) => {
      if (typeof sql === "string" && sql.includes("FROM venues WHERE venue_id")) return { rows: [] };
      throw new Error("should not reach further queries");
    });
    const run = await startWorkflow("high-crowd", { venue_id: 999999 }, { triggeredBy: "admin" });
    expect(run.status).toBe("failed");
    expect(run.steps[0].error).toMatch(/not found/);
  });
});
